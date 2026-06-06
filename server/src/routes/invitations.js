const router = require('express').Router();
const pool = require('../db/pool');

// Look up a pending invitation by token (no auth needed — used on the register page to pre-fill email)
router.get('/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.invited_email, w.name AS workspace_name, u.display_name AS inviter_name
       FROM invitations i
       JOIN workspaces w ON w.id = i.workspace_id
       JOIN users u ON u.id = i.invited_by
       WHERE i.token = $1 AND i.accepted_at IS NULL`,
      [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Invitation not found or already used' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
