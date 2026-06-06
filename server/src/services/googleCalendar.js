const { google } = require('googleapis');
const pool = require('../db/pool');

function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Returns an authorized OAuth2 client for a user, refreshing the token if needed.
async function getClientForUser(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM google_tokens WHERE user_id = $1',
    [userId]
  );
  if (!rows[0]) return null;

  const oauth2 = makeOAuthClient();
  oauth2.setCredentials({
    access_token: rows[0].access_token,
    refresh_token: rows[0].refresh_token,
    expiry_date: rows[0].token_expiry ? new Date(rows[0].token_expiry).getTime() : undefined,
  });

  // Persist refreshed tokens automatically
  oauth2.on('tokens', async (tokens) => {
    await pool.query(
      `UPDATE google_tokens
       SET access_token = COALESCE($1, access_token),
           refresh_token = COALESCE($2, refresh_token),
           token_expiry = $3,
           updated_at = NOW()
       WHERE user_id = $4`,
      [
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        userId,
      ]
    );
  });

  return oauth2;
}

function buildEventBody(meeting, attendeeEmails = []) {
  const event = {
    summary: meeting.title,
    description: meeting.description || '',
    start: {
      dateTime: new Date(meeting.start_time).toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: meeting.end_time
        ? new Date(meeting.end_time).toISOString()
        : new Date(new Date(meeting.start_time).getTime() + 60 * 60 * 1000).toISOString(),
      timeZone: 'UTC',
    },
    reminders: {
      useDefault: true,
    },
  };

  if (attendeeEmails.length > 0) {
    event.attendees = attendeeEmails.map((email) => ({ email }));
    // Send invite emails via Google
    event.guestsCanSeeOtherGuests = true;
  }

  return event;
}

async function getAttendeeEmails(meetingId) {
  const { rows } = await pool.query(
    `SELECT u.email FROM meeting_attendees ma
     JOIN users u ON u.id = ma.user_id
     WHERE ma.meeting_id = $1`,
    [meetingId]
  );
  return rows.map((r) => r.email);
}

async function createEvent(userId, meeting) {
  const auth = await getClientForUser(userId);
  if (!auth) return null;

  const attendeeEmails = await getAttendeeEmails(meeting.id);
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: 'all',
      requestBody: buildEventBody(meeting, attendeeEmails),
    });
    return data.id;
  } catch (err) {
    console.error('Google Calendar createEvent error:', err.message);
    return null;
  }
}

async function updateEvent(userId, googleEventId, meeting) {
  const auth = await getClientForUser(userId);
  if (!auth) return;

  const attendeeEmails = await getAttendeeEmails(meeting.id);
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      sendUpdates: 'all',
      requestBody: buildEventBody(meeting, attendeeEmails),
    });
  } catch (err) {
    console.error('Google Calendar updateEvent error:', err.message);
  }
}

async function deleteEvent(userId, googleEventId) {
  const auth = await getClientForUser(userId);
  if (!auth) return;

  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
      sendUpdates: 'all',
    });
  } catch (err) {
    if (err.code !== 410) console.error('Google Calendar deleteEvent error:', err.message);
  }
}

module.exports = { makeOAuthClient, getClientForUser, createEvent, updateEvent, deleteEvent };
