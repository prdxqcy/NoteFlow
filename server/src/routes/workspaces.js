const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { sendWorkspaceInvite } = require('../services/email');

router.use(auth);

async function findOwnedWorkspace(workspaceId, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM workspaces WHERE id = $1 AND owner_id = $2',
    [workspaceId, userId]
  );
  return rows[0];
}

async function findManagedWorkspace(workspaceId, userId) {
  const { rows } = await pool.query(
    `SELECT w.*
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE w.id = $1 AND wm.user_id = $2
       AND (w.owner_id = $2 OR wm.role = 'admin')`,
    [workspaceId, userId]
  );
  return rows[0];
}

// List all workspaces the user belongs to
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, u.display_name AS owner_name, wm.role AS membership_role
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       JOIN users u ON u.id = w.owner_id
       WHERE wm.user_id = $1
       ORDER BY w.created_at ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit workspace details
router.patch('/:id', async (req, res) => {
  try {
    const workspace = await findManagedWorkspace(req.params.id, req.user.id);
    if (!workspace) return res.status(403).json({ error: 'Only workspace owners and admins can edit it' });

    const name = req.body.name === undefined ? workspace.name : String(req.body.name).trim();
    const description = req.body.description === undefined
      ? workspace.description
      : String(req.body.description).trim();

    if (!name) return res.status(400).json({ error: 'Workspace name is required' });
    if (name.length > 120) return res.status(400).json({ error: 'Workspace name is too long' });
    if (description.length > 1000) return res.status(400).json({ error: 'Description is too long' });

    const { rows } = await pool.query(
      `UPDATE workspaces SET name = $1, description = $2
       WHERE id = $3 RETURNING *`,
      [name, description, workspace.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a workspace
router.post('/', async (req, res) => {
  const { name, is_solo = false } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO workspaces (name, owner_id, is_solo)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, req.user.id, is_solo]
    );
    const ws = rows[0];
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [ws.id, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json(ws);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Invite a user by email.
// If the email belongs to an existing user → add them to workspace directly.
// If not → create an invitation record and send an email invite.
router.post('/:id/invite', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const { rows: wsRows } = await pool.query(
      `SELECT w.*, u.display_name AS owner_name
       FROM workspaces w
       JOIN users u ON u.id = w.owner_id
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE w.id = $1 AND wm.user_id = $2
         AND (w.owner_id = $2 OR wm.role = 'admin')`,
      [req.params.id, req.user.id]
    );
    if (!wsRows[0]) return res.status(403).json({ error: 'Only workspace owners and admins can invite members' });
    const workspace = wsRows[0];

    // Fetch inviter name
    const { rows: inviterRows } = await pool.query(
      'SELECT display_name FROM users WHERE id = $1',
      [req.user.id]
    );
    const inviterName = inviterRows[0]?.display_name || 'Someone';

    // Check if this email already has an account
    const { rows: userRows } = await pool.query(
      'SELECT id, display_name, email FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (userRows[0]) {
      // Existing user: add directly to workspace
      await pool.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT DO NOTHING`,
        [req.params.id, userRows[0].id]
      );
      return res.json({ type: 'added', member: userRows[0] });
    }

    // New user: create invitation record (upsert) and send email
    const { rows: invRows } = await pool.query(
      `INSERT INTO invitations (workspace_id, invited_email, invited_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, invited_email) DO UPDATE
         SET invited_by = EXCLUDED.invited_by,
             accepted_at = NULL,
             created_at = NOW()
       RETURNING token`,
      [req.params.id, normalizedEmail, req.user.id]
    );
    const token = invRows[0].token;

    // Send invite email (non-blocking so the response isn't delayed)
    sendWorkspaceInvite({
      toEmail: normalizedEmail,
      workspaceName: workspace.name,
      inviterName,
      token,
    }).catch((err) => console.error('sendWorkspaceInvite error:', err));

    return res.json({ type: 'invited', email: normalizedEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change a member's role
router.patch('/:id/members/:userId', async (req, res) => {
  try {
    const workspace = await findManagedWorkspace(req.params.id, req.user.id);
    if (!workspace) return res.status(403).json({ error: 'Only workspace owners and admins can manage members' });
    if (req.params.userId === workspace.owner_id) {
      return res.status(400).json({ error: 'The owner role cannot be changed' });
    }

    const role = String(req.body.role || '').toLowerCase();
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or member' });
    }

    const { rows } = await pool.query(
      `UPDATE workspace_members SET role = $1
       WHERE workspace_id = $2 AND user_id = $3
       RETURNING user_id, role`,
      [role, workspace.id, req.params.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Workspace member not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove a member
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const workspace = await findManagedWorkspace(req.params.id, req.user.id);
    if (!workspace) return res.status(403).json({ error: 'Only workspace owners and admins can manage members' });
    if (req.params.userId === workspace.owner_id) {
      return res.status(400).json({ error: 'The workspace owner cannot be removed' });
    }

    const { rows } = await pool.query(
      `DELETE FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2
       RETURNING user_id`,
      [workspace.id, req.params.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Workspace member not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a workspace
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM workspaces WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    );
    const workspace = rows[0];
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    if (workspace.is_solo) {
      return res.status(400).json({ error: 'Personal workspaces cannot be deleted' });
    }

    await pool.query('DELETE FROM workspaces WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List members
router.get('/:id/members', async (req, res) => {
  try {
    const access = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!access.rows[0]) return res.status(403).json({ error: 'You do not have access to this workspace' });

    const { rows } = await pool.query(
      `SELECT u.id, u.display_name, u.email, u.avatar_url, wm.role
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
