const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

router.post('/register', async (req, res) => {
  const { email, password, display_name, invite_token } = req.body;
  if (!email || !password || !display_name) {
    return res.status(400).json({ error: 'email, password and display_name required' });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, created_at`,
      [normalizedEmail, hash, display_name]
    );
    const user = rows[0];

    // Auto-create a personal workspace and add user as owner member
    const { rows: wsRows } = await client.query(
      `INSERT INTO workspaces (name, owner_id, is_solo)
       VALUES ($1, $2, true) RETURNING id`,
      ['Personal', user.id]
    );
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [wsRows[0].id, user.id]
    );

    // Accept a specific invite token if provided
    if (invite_token) {
      const { rows: invRows } = await client.query(
        `SELECT * FROM invitations
         WHERE token = $1 AND invited_email = $2 AND accepted_at IS NULL`,
        [invite_token, normalizedEmail]
      );
      if (invRows[0]) {
        await client.query(
          `INSERT INTO workspace_members (workspace_id, user_id, role)
           VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
          [invRows[0].workspace_id, user.id]
        );
        await client.query(
          `UPDATE invitations SET accepted_at = NOW() WHERE id = $1`,
          [invRows[0].id]
        );
      }
    }

    // Auto-join any other pending invitations for this email
    const { rows: pendingInvites } = await client.query(
      `SELECT * FROM invitations
       WHERE invited_email = $1 AND accepted_at IS NULL`,
      [normalizedEmail]
    );
    for (const inv of pendingInvites) {
      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
        [inv.workspace_id, user.id]
      );
      await client.query(
        `UPDATE invitations SET accepted_at = NOW() WHERE id = $1`,
        [inv.id]
      );
    }

    await client.query('COMMIT');

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
    res.status(201).json({ token, user });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/onesignal', require('../middleware/auth'), async (req, res) => {
  const { player_id } = req.body;
  if (!player_id) return res.status(400).json({ error: 'player_id required' });
  await pool.query('UPDATE users SET onesignal_player_id = $1 WHERE id = $2', [
    player_id,
    req.user.id,
  ]);
  res.json({ ok: true });
});

module.exports = router;
