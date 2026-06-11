const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { recognize } = require('tesseract.js');

router.use(auth);

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

async function assertMember(workspaceId, userId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  );
  return rows.length > 0;
}

async function assertPermission(workspaceId, userId, permission) {
  const { rows } = await pool.query(
    `SELECT wm.role, wm.permissions, w.owner_id FROM workspace_members wm
     JOIN workspaces w ON w.id=wm.workspace_id WHERE wm.workspace_id=$1 AND wm.user_id=$2`,
    [workspaceId, userId]
  );
  const member = rows[0];
  return Boolean(member && (member.owner_id === userId || member.role === 'admin' || member.permissions?.[permission] !== false));
}

async function getNoteWithImages(noteId) {
  const { rows } = await pool.query(
    `SELECT n.*, u.display_name AS author_name,
       COALESCE(
         (
           SELECT json_agg(
           json_build_object(
             'id', ni.id,
             'mime_type', ni.mime_type,
             'section_id', ni.section_id,
             'context_title', ni.context_title,
             'context_content', ni.context_content,
             'context_updated_at', ni.context_updated_at,
             'annotations', COALESCE((SELECT json_agg(json_build_object('id', ia.id, 'x', ia.x, 'y', ia.y, 'kind', ia.kind, 'color', ia.color, 'body', ia.body, 'display_name', au.display_name) ORDER BY ia.created_at) FROM image_annotations ia JOIN users au ON au.id=ia.user_id WHERE ia.image_id=ni.id), '[]'),
             'created_at', ni.created_at
           )
           ORDER BY ni.created_at
           )
           FROM note_images ni WHERE ni.note_id = n.id
         ),
         '[]'
       ) AS images,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', nl.id,
               'source_note_id', nl.source_note_id,
               'target_note_id', nl.target_note_id
             )
             ORDER BY nl.created_at
           )
           FROM note_links nl
           WHERE nl.source_note_id = n.id OR nl.target_note_id = n.id
         ),
         '[]'
       ) AS links,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', ns.id,
               'title', ns.title,
               'content', ns.content,
               'context_updated_at', ns.context_updated_at,
               'sort_order', ns.sort_order
             )
             ORDER BY ns.sort_order, ns.context_updated_at DESC
           )
           FROM note_sections ns WHERE ns.note_id = n.id
         ),
         '[]'
       ) AS sections
     FROM notes n
     JOIN users u ON u.id = n.created_by
     WHERE n.id = $1
     GROUP BY n.id, u.display_name`,
    [noteId]
  );
  return rows[0];
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
           (
             SELECT json_agg(
             json_build_object(
               'id', ni.id,
               'mime_type', ni.mime_type,
               'section_id', ni.section_id,
               'context_title', ni.context_title,
               'context_content', ni.context_content,
               'context_updated_at', ni.context_updated_at,
               'annotations', COALESCE((SELECT json_agg(json_build_object('id', ia.id, 'x', ia.x, 'y', ia.y, 'kind', ia.kind, 'color', ia.color, 'body', ia.body, 'display_name', au.display_name) ORDER BY ia.created_at) FROM image_annotations ia JOIN users au ON au.id=ia.user_id WHERE ia.image_id=ni.id), '[]'),
               'created_at', ni.created_at
             )
             ORDER BY ni.created_at
             )
             FROM note_images ni WHERE ni.note_id = n.id
           ),
           '[]'
         ) AS images,
         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'id', nl.id,
                 'source_note_id', nl.source_note_id,
                 'target_note_id', nl.target_note_id
               )
               ORDER BY nl.created_at
             )
             FROM note_links nl
             WHERE nl.source_note_id = n.id OR nl.target_note_id = n.id
           ),
           '[]'
         ) AS links,
         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'id', ns.id,
                 'title', ns.title,
                 'content', ns.content,
                 'context_updated_at', ns.context_updated_at,
                 'sort_order', ns.sort_order
               )
               ORDER BY ns.sort_order, ns.context_updated_at DESC
             )
             FROM note_sections ns WHERE ns.note_id = n.id
           ),
           '[]'
         ) AS sections
       FROM notes n
       JOIN users u ON u.id = n.created_by
       WHERE n.workspace_id = $1
         AND (NOT n.is_private OR n.created_by = $2)
       GROUP BY n.id, u.display_name
       ORDER BY n.is_pinned DESC, n.sort_order ASC, n.updated_at DESC`,
      [req.params.workspaceId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/workspace/:workspaceId/order', async (req, res) => {
  const { note_ids } = req.body;
  if (!Array.isArray(note_ids) || note_ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'note_ids must be an array' });
  }
  if (!(await assertMember(req.params.workspaceId, req.user.id))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [index, noteId] of note_ids.entries()) {
      const result = await client.query(
        'UPDATE notes SET sort_order = $1 WHERE id = $2 AND workspace_id = $3',
        [index + 1, noteId, req.params.workspaceId]
      );
      if (!result.rowCount) throw new Error('Invalid note order');
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: 'Could not save note order' });
  } finally {
    client.release();
  }
});

router.post('/:id/links', async (req, res) => {
  const { target_id } = req.body;
  if (!target_id || target_id === req.params.id) {
    return res.status(400).json({ error: 'Choose two different notes' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM notes WHERE id = ANY($1::uuid[])',
      [[req.params.id, target_id]]
    );
    const source = rows.find((note) => note.id === req.params.id);
    const target = rows.find((note) => note.id === target_id);
    if (!source || !target) return res.status(404).json({ error: 'Note not found' });
    if (source.workspace_id !== target.workspace_id) {
      return res.status(400).json({ error: 'Notes must be in the same workspace' });
    }
    if (
      (source.is_private && source.created_by !== req.user.id) ||
      (target.is_private && target.created_by !== req.user.id)
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertMember(source.workspace_id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertPermission(source.workspace_id, req.user.id, 'edit_notes'))) {
      return res.status(403).json({ error: 'You do not have permission to connect notes' });
    }

    const { rows: linkRows } = await pool.query(
      `WITH existing AS (
         SELECT id, source_note_id, target_note_id
         FROM note_links
         WHERE source_note_id = $2 AND target_note_id = $3
       ), inserted AS (
         INSERT INTO note_links (workspace_id, source_note_id, target_note_id, created_by)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (SELECT 1 FROM existing)
         RETURNING id, source_note_id, target_note_id
       )
       SELECT * FROM inserted
       UNION ALL
       SELECT * FROM existing
       LIMIT 1`,
      [source.workspace_id, source.id, target.id, req.user.id]
    );
    res.status(201).json(linkRows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create note connection' });
  }
});

router.delete('/:noteId/links/:linkId', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [req.params.noteId]);
    const note = rows[0];
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (!(await assertMember(note.workspace_id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertPermission(note.workspace_id, req.user.id, 'edit_notes'))) {
      return res.status(403).json({ error: 'You do not have permission to edit notes' });
    }
    const result = await pool.query(
      `DELETE FROM note_links
       WHERE id = $1
         AND workspace_id = $2
         AND (source_note_id = $3 OR target_note_id = $3)`,
      [req.params.linkId, note.workspace_id, note.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Connection not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete note connection' });
  }
});

router.post('/:targetId/merge', async (req, res) => {
  const { source_id } = req.body;
  if (!source_id || source_id === req.params.targetId) {
    return res.status(400).json({ error: 'Choose two different notes' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM notes WHERE id = ANY($1::uuid[]) FOR UPDATE',
      [[source_id, req.params.targetId]]
    );
    const source = rows.find((note) => note.id === source_id);
    const target = rows.find((note) => note.id === req.params.targetId);
    if (!source || !target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Note not found' });
    }
    if (source.workspace_id !== target.workspace_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Notes must be in the same workspace' });
    }
    if (
      (source.is_private && source.created_by !== req.user.id) ||
      (target.is_private && target.created_by !== req.user.id)
    ) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertMember(target.workspace_id, req.user.id))) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertPermission(target.workspace_id, req.user.id, 'merge_notes'))) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You do not have permission to merge notes' });
    }

    const notesByRecency = [source, target].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const mergedContent = notesByRecency
      .map((note, index) => {
        const label = index === 0 ? 'NEWER NOTE' : 'OLDER NOTE';
        const timestamp = new Date(note.updated_at).toISOString();
        return `--- ${label}: ${note.title} (${timestamp}) ---\n${note.content?.trim() || '(No text)'}`;
      })
      .join('\n\n');
    const mergedTitle = notesByRecency[0].title === 'Untitled'
      ? notesByRecency[1].title
      : notesByRecency[0].title;

    for (const note of [target, source]) {
      const existingSections = await client.query(
        'SELECT id FROM note_sections WHERE note_id = $1',
        [note.id]
      );
      if (!existingSections.rowCount) {
        const { rows: sectionRows } = await client.query(
          `INSERT INTO note_sections (note_id, title, content, context_updated_at)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [note.id, note.title, note.content || '', note.updated_at]
        );
        await client.query(
          'UPDATE note_images SET section_id = $1 WHERE note_id = $2 AND section_id IS NULL',
          [sectionRows[0].id, note.id]
        );
      }
    }
    await client.query(
      'UPDATE note_sections SET note_id = $1 WHERE note_id = $2',
      [target.id, source.id]
    );
    await client.query(
      `WITH ordered AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY context_updated_at DESC, created_at DESC) - 1 AS position
         FROM note_sections WHERE note_id = $1
       )
       UPDATE note_sections SET sort_order = ordered.position
       FROM ordered WHERE note_sections.id = ordered.id`,
      [target.id]
    );

    await client.query(
      `UPDATE note_images
       SET context_title = COALESCE(context_title, $1),
           context_content = COALESCE(context_content, $2),
           context_updated_at = COALESCE(context_updated_at, $3)
       WHERE note_id = $4`,
      [target.title, target.content, target.updated_at, target.id]
    );
    await client.query(
      `UPDATE note_images
       SET note_id = $1,
           context_title = COALESCE(context_title, $2),
           context_content = COALESCE(context_content, $3),
           context_updated_at = COALESCE(context_updated_at, $4)
       WHERE note_id = $5`,
      [target.id, source.title, source.content, source.updated_at, source.id]
    );
    await client.query(
      `UPDATE note_links
       SET source_note_id = $1
       WHERE source_note_id = $2`,
      [target.id, source.id]
    );
    await client.query(
      `UPDATE note_links
       SET target_note_id = $1
       WHERE target_note_id = $2`,
      [target.id, source.id]
    );
    await client.query(
      'DELETE FROM note_links WHERE source_note_id = target_note_id',
    );
    await client.query(
      `DELETE FROM note_links duplicate
       USING note_links keep
       WHERE duplicate.id <> keep.id
         AND duplicate.source_note_id = keep.source_note_id
         AND duplicate.target_note_id = keep.target_note_id`
    );
    await client.query(
      'UPDATE notes SET title = $1, content = $2 WHERE id = $3',
      [mergedTitle, mergedContent, target.id]
    );
    await client.query('DELETE FROM notes WHERE id = $1', [source.id]);
    await client.query(
      `INSERT INTO workspace_activity(workspace_id,user_id,action,entity_type,entity_id,details)
       VALUES($1,$2,'merged','note',$3,$4)`,
      [target.workspace_id, req.user.id, target.id, { source_title: source.title, target_title: target.title }]
    );
    await client.query('COMMIT');

    res.json(await getNoteWithImages(target.id));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not merge notes' });
  } finally {
    client.release();
  }
});

router.patch('/:noteId/sections/:sectionId', async (req, res) => {
  const { title, content } = req.body;
  try {
    const { rows: noteRows } = await pool.query('SELECT * FROM notes WHERE id = $1', [req.params.noteId]);
    const note = noteRows[0];
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (!(await assertMember(note.workspace_id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertPermission(note.workspace_id, req.user.id, 'edit_notes'))) {
      return res.status(403).json({ error: 'You do not have permission to edit notes' });
    }
    if (title !== undefined || content !== undefined) {
      await pool.query(
        `INSERT INTO note_versions(note_id,title,content,created_by)
         SELECT id,title,content,$2 FROM notes
         WHERE id=$1 AND NOT EXISTS(
           SELECT 1 FROM note_versions WHERE note_id=$1 AND title=notes.title AND content=notes.content
             AND created_at > NOW() - INTERVAL '30 seconds'
         )`,
        [note.id, req.user.id]
      );
    }

    const { rows } = await pool.query(
      `UPDATE note_sections
       SET title = COALESCE($1, title), content = COALESCE($2, content)
       WHERE id = $3 AND note_id = $4
       RETURNING *`,
      [title, content, req.params.sectionId, note.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Merged note section not found' });
    res.json(rows[0]);
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

    let ocrText = '';
    try {
      const result = await recognize(req.body, 'eng');
      ocrText = result.data?.text?.trim() || '';
    } catch (ocrError) {
      console.error('Screenshot OCR failed:', ocrError.message);
    }
    const { rows: imageRows } = await pool.query(
      `INSERT INTO note_images (note_id, mime_type, image_data, ocr_text)
       VALUES ($1, $2, $3, $4)
       RETURNING id, mime_type, created_at`,
      [note.id, req.headers['content-type'], req.body, ocrText]
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
      `INSERT INTO notes (workspace_id, created_by, title, content, color, sort_order)
       VALUES ($1, $2, $3, $4, $5, (
         SELECT COALESCE(MIN(sort_order), 0) - 1 FROM notes WHERE workspace_id = $1
       )) RETURNING *`,
      [workspace_id, req.user.id, title, content, color || '#ffffff']
    );
    await pool.query(
      `INSERT INTO workspace_activity(workspace_id,user_id,action,entity_type,entity_id,details)
       VALUES($1,$2,'created','note',$3,$4)`,
      [workspace_id, req.user.id, rows[0].id, { title: rows[0].title }]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a note
router.patch('/:id', async (req, res) => {
  const { title, content, color, is_pinned, is_private, position_x, position_y, note_width, note_height } = req.body;
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
    if (!(await assertPermission(note.workspace_id, req.user.id, 'edit_notes'))) {
      return res.status(403).json({ error: 'You do not have permission to edit notes' });
    }
    if (title !== undefined || content !== undefined) {
      await pool.query(
        `INSERT INTO note_versions(note_id,title,content,created_by)
         SELECT id,title,content,$2 FROM notes
         WHERE id=$1 AND NOT EXISTS(
           SELECT 1 FROM note_versions WHERE note_id=$1 AND title=notes.title AND content=notes.content
             AND created_at > NOW() - INTERVAL '30 seconds'
         )`,
        [note.id, req.user.id]
      );
    }
    const { rows } = await pool.query(
      `UPDATE notes
       SET title      = COALESCE($1, title),
           content    = COALESCE($2, content),
           color      = COALESCE($3, color),
           is_pinned  = COALESCE($4, is_pinned),
           is_private = COALESCE($5, is_private),
           position_x = COALESCE($6, position_x),
           position_y = COALESCE($7, position_y),
           note_width = COALESCE($8, note_width),
           note_height = COALESCE($9, note_height)
       WHERE id = $10
       RETURNING *`,
      [title, content, color, is_pinned, is_private, position_x, position_y, note_width, note_height, req.params.id]
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
    await pool.query(
      `INSERT INTO workspace_activity(workspace_id,user_id,action,entity_type,entity_id,details)
       VALUES($1,$2,'deleted','note',$3,$4)`,
      [note.workspace_id, req.user.id, note.id, { title: note.title }]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
