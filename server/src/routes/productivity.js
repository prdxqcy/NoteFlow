const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();

async function membership(workspaceId, userId) {
  const { rows } = await pool.query(
    `SELECT wm.*, w.owner_id FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
    [workspaceId, userId]
  );
  return rows[0];
}

async function noteAccess(noteId, userId) {
  const { rows } = await pool.query(
    `SELECT n.*, wm.role, wm.permissions, w.owner_id
     FROM notes n JOIN workspaces w ON w.id = n.workspace_id
     JOIN workspace_members wm ON wm.workspace_id = n.workspace_id
     WHERE n.id = $1 AND wm.user_id = $2 AND (NOT n.is_private OR n.created_by = $2)`,
    [noteId, userId]
  );
  return rows[0];
}

function canManage(member) {
  return member && (member.owner_id === member.user_id || member.role === 'admin');
}

async function activity(workspaceId, userId, action, entityType, entityId, details = {}) {
  await pool.query(
    `INSERT INTO workspace_activity (workspace_id, user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [workspaceId, userId, action, entityType, entityId, details]
  );
}

async function publicNote(token, password) {
  const { rows } = await pool.query(
    `SELECT n.id, n.title, n.content, n.updated_at, u.display_name AS author_name, ps.password_hash
     FROM public_shares ps JOIN notes n ON n.id = ps.note_id JOIN users u ON u.id = n.created_by
     WHERE ps.token = $1 AND (ps.expires_at IS NULL OR ps.expires_at > NOW())`,
    [token]
  );
  if (!rows[0]) return null;
  if (rows[0].password_hash && !(await bcrypt.compare(password || '', rows[0].password_hash))) return false;
  delete rows[0].password_hash;
  return rows[0];
}

router.get('/public/:token', async (req, res) => {
  const note = await publicNote(req.params.token);
  if (note === false) return res.status(401).json({ error: 'Password required', password_required: true });
  if (!note) return res.status(404).json({ error: 'Share not found or expired' });
  res.json(note);
});

router.post('/public/:token/access', async (req, res) => {
  const note = await publicNote(req.params.token, req.body.password);
  if (note === false) return res.status(401).json({ error: 'Incorrect password', password_required: true });
  if (!note) return res.status(404).json({ error: 'Share not found or expired' });
  res.json(note);
});

router.use(auth);

router.get('/workspace/:workspaceId/overview', async (req, res) => {
  if (!(await membership(req.params.workspaceId, req.user.id))) return res.status(403).json({ error: 'Access denied' });
  await pool.query(
    `INSERT INTO notifications(user_id,workspace_id,type,message,entity_type,entity_id)
     SELECT assigned_to,workspace_id,'reminder','Task due soon: ' || title,'task',id FROM tasks t
     WHERE workspace_id=$1 AND assigned_to=$2 AND status<>'done' AND due_at BETWEEN NOW() AND NOW()+INTERVAL '24 hours'
       AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=t.assigned_to AND n.entity_id=t.id AND n.type='reminder' AND n.created_at > NOW()-INTERVAL '12 hours')`,
    [req.params.workspaceId, req.user.id]
  );
  const [tasks, templates, activityRows, notifications] = await Promise.all([
    pool.query(`SELECT t.*, u.display_name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to WHERE t.workspace_id=$1 ORDER BY t.status, t.due_at NULLS LAST`, [req.params.workspaceId]),
    pool.query('SELECT * FROM note_templates WHERE workspace_id=$1 ORDER BY created_at DESC', [req.params.workspaceId]),
    pool.query(`SELECT a.*, u.display_name FROM workspace_activity a LEFT JOIN users u ON u.id=a.user_id WHERE a.workspace_id=$1 ORDER BY a.created_at DESC LIMIT 50`, [req.params.workspaceId]),
    pool.query(`SELECT * FROM notifications WHERE user_id=$1 AND (workspace_id=$2 OR workspace_id IS NULL) ORDER BY created_at DESC LIMIT 50`, [req.user.id, req.params.workspaceId]),
  ]);
  res.json({ tasks: tasks.rows, templates: templates.rows, activity: activityRows.rows, notifications: notifications.rows });
});

router.get('/workspace/:workspaceId/search', async (req, res) => {
  if (!(await membership(req.params.workspaceId, req.user.id))) return res.status(403).json({ error: 'Access denied' });
  const term = `%${String(req.query.q || '').trim()}%`;
  const { rows } = await pool.query(
    `SELECT DISTINCT n.id, n.title, n.content, n.updated_at,
       EXISTS(SELECT 1 FROM note_images ni WHERE ni.note_id=n.id) AS has_screenshot
     FROM notes n LEFT JOIN note_sections ns ON ns.note_id=n.id LEFT JOIN note_images ni ON ni.note_id=n.id
     WHERE n.workspace_id=$1 AND (NOT n.is_private OR n.created_by=$2)
       AND ($3='%%' OR n.title ILIKE $3 OR n.content ILIKE $3 OR ns.title ILIKE $3 OR ns.content ILIKE $3
         OR ni.context_title ILIKE $3 OR ni.context_content ILIKE $3 OR ni.ocr_text ILIKE $3)
       AND ($4::boolean IS FALSE OR EXISTS(SELECT 1 FROM note_images x WHERE x.note_id=n.id))
     ORDER BY n.updated_at DESC`,
    [req.params.workspaceId, req.user.id, term, req.query.has_screenshot === 'true']
  );
  res.json(rows);
});

router.post('/tasks', async (req, res) => {
  const member = await membership(req.body.workspace_id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Access denied' });
  if (!canManage(member) && member.permissions?.manage_tasks === false) return res.status(403).json({ error: 'Task permission required' });
  const { rows } = await pool.query(
    `INSERT INTO tasks (workspace_id,note_id,title,description,status,priority,assigned_to,due_at,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.body.workspace_id, req.body.note_id || null, req.body.title, req.body.description || '', req.body.status || 'todo', req.body.priority || 'medium', req.body.assigned_to || null, req.body.due_at || null, req.user.id]
  );
  await activity(req.body.workspace_id, req.user.id, 'created', 'task', rows[0].id, { title: rows[0].title });
  if (rows[0].assigned_to && rows[0].assigned_to !== req.user.id) {
    await pool.query(`INSERT INTO notifications(user_id,workspace_id,type,message,entity_type,entity_id) VALUES($1,$2,'assignment',$3,'task',$4)`, [rows[0].assigned_to, req.body.workspace_id, `You were assigned: ${rows[0].title}`, rows[0].id]);
  }
  res.status(201).json(rows[0]);
});

router.patch('/tasks/:id', async (req, res) => {
  const { rows: found } = await pool.query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
  if (!found[0] || !(await membership(found[0].workspace_id, req.user.id))) return res.status(404).json({ error: 'Task not found' });
  const { rows } = await pool.query(
    `UPDATE tasks SET title=COALESCE($1,title),description=COALESCE($2,description),status=COALESCE($3,status),
     priority=COALESCE($4,priority),assigned_to=COALESCE($5,assigned_to),due_at=COALESCE($6,due_at),updated_at=NOW()
     WHERE id=$7 RETURNING *`,
    [req.body.title, req.body.description, req.body.status, req.body.priority, req.body.assigned_to, req.body.due_at, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/tasks/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
  if (!rows[0] || !(await membership(rows[0].workspace_id, req.user.id))) return res.status(404).json({ error: 'Task not found' });
  await pool.query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

router.get('/notes/:noteId/details', async (req, res) => {
  if (!(await noteAccess(req.params.noteId, req.user.id))) return res.status(403).json({ error: 'Access denied' });
  const [comments, versions, annotations, shares] = await Promise.all([
    pool.query(`SELECT c.*,u.display_name FROM note_comments c JOIN users u ON u.id=c.user_id WHERE c.note_id=$1 ORDER BY c.created_at`, [req.params.noteId]),
    pool.query(`SELECT v.*,u.display_name FROM note_versions v LEFT JOIN users u ON u.id=v.created_by WHERE v.note_id=$1 ORDER BY v.created_at DESC LIMIT 50`, [req.params.noteId]),
    pool.query(`SELECT a.*,u.display_name FROM image_annotations a JOIN users u ON u.id=a.user_id JOIN note_images ni ON ni.id=a.image_id WHERE ni.note_id=$1 ORDER BY a.created_at`, [req.params.noteId]),
    pool.query('SELECT token,expires_at,created_at FROM public_shares WHERE note_id=$1 ORDER BY created_at DESC', [req.params.noteId]),
  ]);
  res.json({ comments: comments.rows, versions: versions.rows, annotations: annotations.rows, shares: shares.rows });
});

router.post('/notes/:noteId/comments', async (req, res) => {
  const note = await noteAccess(req.params.noteId, req.user.id);
  if (!note) return res.status(403).json({ error: 'Access denied' });
  const { rows } = await pool.query(`INSERT INTO note_comments(note_id,user_id,body) VALUES($1,$2,$3) RETURNING *`, [note.id, req.user.id, req.body.body]);
  const mentions = [...String(req.body.body).matchAll(/@([\w.+-]+@[\w.-]+|\w[\w ]+)/g)].map((match) => match[1].trim());
  for (const mention of mentions) {
    await pool.query(
      `INSERT INTO notifications(user_id,workspace_id,type,message,entity_type,entity_id)
       SELECT id,$1,'mention',$2,'note',$3 FROM users WHERE lower(email)=lower($4) OR lower(display_name)=lower($4)`,
      [note.workspace_id, `You were mentioned in ${note.title}`, note.id, mention]
    );
  }
  await activity(note.workspace_id, req.user.id, 'commented', 'note', note.id, { body: req.body.body.slice(0, 120) });
  res.status(201).json(rows[0]);
});

router.patch('/comments/:id', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE note_comments c SET resolved_at=CASE WHEN $1 THEN NOW() ELSE NULL END
     FROM notes n, workspace_members wm
     WHERE c.id=$2 AND n.id=c.note_id AND wm.workspace_id=n.workspace_id AND wm.user_id=$3
     RETURNING c.*`,
    [Boolean(req.body.resolved), req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Comment not found' });
  res.json(rows[0]);
});

router.post('/images/:imageId/annotations', async (req, res) => {
  const { rows: images } = await pool.query(`SELECT ni.*,n.workspace_id FROM note_images ni JOIN notes n ON n.id=ni.note_id WHERE ni.id=$1`, [req.params.imageId]);
  if (!images[0] || !(await membership(images[0].workspace_id, req.user.id))) return res.status(403).json({ error: 'Access denied' });
  const { rows } = await pool.query(
    `INSERT INTO image_annotations(image_id,user_id,kind,x,y,width,height,color,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.params.imageId, req.user.id, req.body.kind || 'comment', req.body.x, req.body.y, req.body.width || null, req.body.height || null, req.body.color || '#10b981', req.body.body || '']
  );
  res.status(201).json(rows[0]);
});

router.delete('/annotations/:id', async (req, res) => {
  await pool.query('DELETE FROM image_annotations WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.post('/notes/:noteId/restore/:versionId', async (req, res) => {
  const note = await noteAccess(req.params.noteId, req.user.id);
  if (!note) return res.status(403).json({ error: 'Access denied' });
  const { rows } = await pool.query(`UPDATE notes n SET title=v.title,content=v.content FROM note_versions v WHERE n.id=$1 AND v.id=$2 AND v.note_id=n.id RETURNING n.*`, [note.id, req.params.versionId]);
  if (!rows[0]) return res.status(404).json({ error: 'Version not found' });
  res.json(rows[0]);
});

router.post('/templates', async (req, res) => {
  if (!(await membership(req.body.workspace_id, req.user.id))) return res.status(403).json({ error: 'Access denied' });
  const { rows } = await pool.query(`INSERT INTO note_templates(workspace_id,name,title,content,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`, [req.body.workspace_id, req.body.name, req.body.title || 'Untitled', req.body.content || '', req.user.id]);
  res.status(201).json(rows[0]);
});

router.post('/templates/:id/use', async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO notes(workspace_id,created_by,title,content)
     SELECT nt.workspace_id,$1,nt.title,nt.content FROM note_templates nt
     JOIN workspace_members wm ON wm.workspace_id=nt.workspace_id
     WHERE nt.id=$2 AND wm.user_id=$1 RETURNING *`,
    [req.user.id, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Template not found' });
  res.status(201).json(rows[0]);
});

router.delete('/templates/:id', async (req, res) => {
  await pool.query('DELETE FROM note_templates WHERE id=$1 AND created_by=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.post('/notes/:noteId/share', async (req, res) => {
  const note = await noteAccess(req.params.noteId, req.user.id);
  if (!note) return res.status(403).json({ error: 'Access denied' });
  const passwordHash = req.body.password ? await bcrypt.hash(req.body.password, 10) : null;
  const { rows } = await pool.query(`INSERT INTO public_shares(note_id,expires_at,created_by,password_hash) VALUES($1,$2,$3,$4) RETURNING token,expires_at`, [note.id, req.body.expires_at || null, req.user.id, passwordHash]);
  res.status(201).json(rows[0]);
});

router.delete('/shares/:token', async (req, res) => {
  await pool.query('DELETE FROM public_shares WHERE token=$1 AND created_by=$2', [req.params.token, req.user.id]);
  res.json({ ok: true });
});

router.patch('/notifications/:id/read', async (req, res) => {
  const { rows } = await pool.query('UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *', [req.params.id, req.user.id]);
  res.json(rows[0]);
});

router.patch('/workspace/:workspaceId/members/:userId/permissions', async (req, res) => {
  const manager = await membership(req.params.workspaceId, req.user.id);
  if (!canManage(manager)) return res.status(403).json({ error: 'Manage permission required' });
  const { rows } = await pool.query(`UPDATE workspace_members SET permissions=$1 WHERE workspace_id=$2 AND user_id=$3 RETURNING user_id,role,permissions`, [req.body.permissions || {}, req.params.workspaceId, req.params.userId]);
  res.json(rows[0]);
});

module.exports = router;
