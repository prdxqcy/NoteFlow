const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

router.use(auth);

async function assertMember(workspaceId, userId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  );
  return rows.length > 0;
}

// Get all notes for a workspace
router.get('/workspace/:workspaceId', async (req, res) => {
  if (!(await assertMember(req.params.workspaceId, req.user.id))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT n.*, u.display_name AS author_name
       FROM notes n
       JOIN users u ON u.id = n.created_by
       WHERE n.workspace_id = $1
       ORDER BY n.is_pinned DESC, n.updated_at DESC`,
      [req.params.workspaceId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a note
router.post('/', async (req, res) => {
  const { workspace_id, title = 'Untitled', content = '', color } = req.body;
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
  if (!(await assertMember(workspace_id, req.user.id))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO notes (workspace_id, created_by, title, content, color)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [workspace_id, req.user.id, title, content, color || '#ffffff']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a note
router.patch('/:id', async (req, res) => {
  const { title, content, color, is_pinned } = req.body;
  try {
    const { rows: noteRows } = await pool.query(
      'SELECT * FROM notes WHERE id = $1',
      [req.params.id]
    );
    const note = noteRows[0];
    if (!note) return res.status(404).json({ error: 'Not found' });
    if (!(await assertMember(note.workspace_id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { rows } = await pool.query(
      `UPDATE notes
       SET title     = COALESCE($1, title),
           content   = COALESCE($2, content),
           color     = COALESCE($3, color),
           is_pinned = COALESCE($4, is_pinned)
       WHERE id = $5
       RETURNING *`,
      [title, content, color, is_pinned, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a note
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    const note = rows[0];
    if (!note) return res.status(404).json({ error: 'Not found' });
    if (!(await assertMember(note.workspace_id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await pool.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
