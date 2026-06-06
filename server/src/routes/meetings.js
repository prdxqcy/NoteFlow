const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const gcal = require('../services/googleCalendar');

router.use(auth);

async function assertMember(workspaceId, userId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  );
  return rows.length > 0;
}

// Get meetings for a workspace
router.get('/workspace/:workspaceId', async (req, res) => {
  if (!(await assertMember(req.params.workspaceId, req.user.id))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT m.*,
              u.display_name AS creator_name,
              json_agg(json_build_object('id', att.id, 'display_name', att.display_name, 'status', ma.status))
                FILTER (WHERE att.id IS NOT NULL) AS attendees
       FROM meetings m
       JOIN users u ON u.id = m.created_by
       LEFT JOIN meeting_attendees ma ON ma.meeting_id = m.id
       LEFT JOIN users att ON att.id = ma.user_id
       WHERE m.workspace_id = $1
       GROUP BY m.id, u.display_name
       ORDER BY m.start_time ASC`,
      [req.params.workspaceId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a meeting
router.post('/', async (req, res) => {
  const { workspace_id, title, description, start_time, end_time, attendee_ids = [], guest_emails = [] } = req.body;
  if (!workspace_id || !title || !start_time) {
    return res.status(400).json({ error: 'workspace_id, title and start_time required' });
  }
  if (!(await assertMember(workspace_id, req.user.id))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const validGuests = Array.isArray(guest_emails)
      ? guest_emails.filter((e) => typeof e === 'string' && e.includes('@'))
      : [];

    const { rows } = await client.query(
      `INSERT INTO meetings (workspace_id, created_by, title, description, start_time, end_time, guest_emails)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [workspace_id, req.user.id, title, description || '', start_time, end_time || null, validGuests]
    );
    const meeting = rows[0];
    const allAttendees = [...new Set([req.user.id, ...attendee_ids])];
    for (const uid of allAttendees) {
      await client.query(
        `INSERT INTO meeting_attendees (meeting_id, user_id, status) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [meeting.id, uid, uid === req.user.id ? 'accepted' : 'invited']
      );
    }
    await client.query('COMMIT');

    // Sync to Google Calendar (non-blocking — don't fail the request if Google is down)
    gcal.createEvent(req.user.id, meeting).then(async (googleEventId) => {
      if (googleEventId) {
        await pool.query('UPDATE meetings SET google_event_id = $1 WHERE id = $2', [
          googleEventId,
          meeting.id,
        ]);
        meeting.google_event_id = googleEventId;
      }
    }).catch((err) => console.error('gcal create background error:', err));

    res.status(201).json(meeting);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Update meeting
router.patch('/:id', async (req, res) => {
  const { title, description, start_time, end_time, status } = req.body;
  try {
    const { rows: mRows } = await pool.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = mRows[0];
    if (!meeting) return res.status(404).json({ error: 'Not found' });
    if (!(await assertMember(meeting.workspace_id, req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { rows } = await pool.query(
      `UPDATE meetings
       SET title       = COALESCE($1, title),
           description = COALESCE($2, description),
           start_time  = COALESCE($3, start_time),
           end_time    = COALESCE($4, end_time),
           status      = COALESCE($5, status)
       WHERE id = $6 RETURNING *`,
      [title, description, start_time, end_time, status, req.params.id]
    );
    const updated = rows[0];

    // Sync update to Google Calendar
    if (updated.google_event_id) {
      gcal.updateEvent(meeting.created_by, updated.google_event_id, updated)
        .catch((err) => console.error('gcal update background error:', err));
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete meeting
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = rows[0];
    if (!meeting) return res.status(404).json({ error: 'Not found' });
    if (meeting.created_by !== req.user.id) return res.status(403).json({ error: 'Only creator can delete' });

    // Delete from Google Calendar before removing from DB
    if (meeting.google_event_id) {
      await gcal.deleteEvent(req.user.id, meeting.google_event_id);
    }

    await pool.query('DELETE FROM meetings WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
