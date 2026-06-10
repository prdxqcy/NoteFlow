const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

router.use(auth);

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

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
      `SELECT n.*, u.display_name AS author_name,
         COALESCE(
           json_agg(
             json_build_object(
               'id', ni.id,
               'mime_type', ni.mime_type,
               'created_at', ni.created_at
             )
             ORDER BY ni.created_at
           ) FILTER (WHERE ni.id IS NOT NULL),
           '[]'
         ) AS images
       FROM notes n
       JOIN users u ON u.id = n.created_by
       LEFT JOIN note_images ni ON ni.note_id = n.id
       WHERE n.workspace_id = $1
         AND (NOT n.is_private OR n.created_by = $2)
       GROUP BY n.id, u.display_name
       ORDER BY n.is_pinned DESC, n.updated_at DESC`,
      [req.params.workspaceId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/images', express.raw({ type: 'image/*', limit: '10mb' }), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    const note = rows[0];
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (!(await assertMember(note.workspace_id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!IMAGE_TYPES.has(req.headers['content-type'])) {
      return res.status(415).json({ error: 'Use a PNG, JPEG, GIF, or WebP image' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Image file required' });
    }

    const { rows: imageRows } = await pool.query(
      `INSERT INTO note_images (note_id, mime_type, image_data)
       VALUES ($1, $2, $3)
       RETURNING id, mime_type, created_at`,
      [note.id, req.headers['content-type'], req.body]
    );
    res.status(201).json(imageRows[0]);
  } catch (err) {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Images must be smaller than 10 MB' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/images/:imageId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ni.mime_type, ni.image_data
       FROM note_images ni
       JOIN notes n ON n.id = ni.note_id
       JOIN workspace_members wm ON wm.workspace_id = n.workspace_id
       WHERE ni.id = $1
         AND wm.user_id = $2
         AND (NOT n.is_private OR n.created_by = $2)`,
      [req.params.imageId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Image not found' });
    res.type(rows[0].mime_type).send(rows[0].image_data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:noteId/images/:imageId', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [req.params.noteId]);
    const note = rows[0];
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (!(await assertMember(note.workspace_id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await pool.query(
      'DELETE FROM note_images WHERE id = $1 AND note_id = $2',
      [req.params.imageId, note.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Image not found' });
    res.json({ ok: true });
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
  const { title, content, color, is_pinned, is_private } = req.body;
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
       SET title      = COALESCE($1, title),
           content    = COALESCE($2, content),
           color      = COALESCE($3, color),
           is_pinned  = COALESCE($4, is_pinned),
           is_private = COALESCE($5, is_private)
       WHERE id = $6
       RETURNING *`,
      [title, content, color, is_pinned, is_private, req.params.id]
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
