const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { makeOAuthClient } = require('../services/googleCalendar');

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

const SIGNIN_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.events',
];

// Step 1 — redirect to Google for calendar connect (requires existing auth).
router.get('/connect-url', auth, (req, res) => {
  const oauth2 = makeOAuthClient();
  const state = Buffer.from(
    JSON.stringify({ token: req.headers.authorization?.slice(7) })
  ).toString('base64');
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: CALENDAR_SCOPES,
    state,
  });
  res.json({ url });
});

// Step 1b — redirect to Google for sign-in (no auth required).
router.get('/signin-url', (req, res) => {
  const clientUrl = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')[0]
    .trim();
  try {
    const oauth2 = makeOAuthClient();
    const state = Buffer.from(JSON.stringify({ signin: true })).toString('base64');
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SIGNIN_SCOPES,
      state,
    });
    res.redirect(url);
  } catch (err) {
    console.error('Google signin-url error:', err);
    res.redirect(`${clientUrl}/login?google_error=config`);
  }
});

// Step 2 — Google redirects back here with a code.
// Handles both: calendar-connect (state.token) and sign-in (state.signin).
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  const clientUrl = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')[0]
    .trim();

  if (error) {
    return res.redirect(`${clientUrl}/login?google_error=denied`);
  }

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(state, 'base64').toString());
  } catch {
    return res.redirect(`${clientUrl}/login?google_error=state`);
  }

  // ── Sign-in flow ──────────────────────────────────────────────────────────
  if (decoded.signin) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const oauth2 = makeOAuthClient();
      const { tokens } = await oauth2.getToken(code);
      oauth2.setCredentials(tokens);

      const { google } = require('googleapis');
      const oauth2api = google.oauth2({ version: 'v2', auth: oauth2 });
      const { data: profile } = await oauth2api.userinfo.get();
      const email = profile.email.toLowerCase().trim();

      // Find or create user
      let { rows } = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      let user = rows[0];

      if (!user) {
        const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
        const displayName = profile.name || email.split('@')[0];
        const { rows: newRows } = await client.query(
          `INSERT INTO users (email, password_hash, display_name)
           VALUES ($1, $2, $3)
           RETURNING id, email, display_name, created_at`,
          [email, randomPassword, displayName]
        );
        user = newRows[0];

        // Personal workspace
        const { rows: wsRows } = await client.query(
          `INSERT INTO workspaces (name, owner_id, is_solo) VALUES ('Personal', $1, true) RETURNING id`,
          [user.id]
        );
        await client.query(
          `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
          [wsRows[0].id, user.id]
        );

        // Accept pending invites
        const { rows: invites } = await client.query(
          `SELECT * FROM invitations WHERE invited_email = $1 AND accepted_at IS NULL`,
          [email]
        );
        for (const inv of invites) {
          await client.query(
            `INSERT INTO workspace_members (workspace_id, user_id, role)
             VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [inv.workspace_id, user.id]
          );
          await client.query(`UPDATE invitations SET accepted_at = NOW() WHERE id = $1`, [inv.id]);
        }
      }

      // Save/update Google tokens — calendar auto-connected
      await client.query(
        `INSERT INTO google_tokens (user_id, access_token, refresh_token, token_expiry, google_email)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE
           SET access_token  = EXCLUDED.access_token,
               refresh_token = COALESCE(EXCLUDED.refresh_token, google_tokens.refresh_token),
               token_expiry  = EXCLUDED.token_expiry,
               google_email  = EXCLUDED.google_email,
               updated_at    = NOW()`,
        [
          user.id,
          tokens.access_token,
          tokens.refresh_token || null,
          tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          profile.email,
        ]
      );

      await client.query('COMMIT');

      const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
        expiresIn: '30d',
      });
      const { password_hash, ...safeUser } = user;

      const gauth = Buffer.from(JSON.stringify({ token, user: safeUser })).toString('base64');
      res.redirect(`${clientUrl}/login?gauth=${encodeURIComponent(gauth)}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Google sign-in error:', err);
      res.redirect(`${clientUrl}/login?google_error=server`);
    } finally {
      client.release();
    }
    return;
  }

  // ── Calendar-connect flow ─────────────────────────────────────────────────
  let userId;
  try {
    const verified = jwt.verify(decoded.token, process.env.JWT_SECRET);
    userId = verified.id;
  } catch {
    return res.redirect(`${clientUrl}/settings?google=error`);
  }

  try {
    const oauth2 = makeOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    const { google } = require('googleapis');
    const oauth2api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data: profile } = await oauth2api.userinfo.get();

    await pool.query(
      `INSERT INTO google_tokens (user_id, access_token, refresh_token, token_expiry, google_email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
         SET access_token  = EXCLUDED.access_token,
             refresh_token = COALESCE(EXCLUDED.refresh_token, google_tokens.refresh_token),
             token_expiry  = EXCLUDED.token_expiry,
             google_email  = EXCLUDED.google_email,
             updated_at    = NOW()`,
      [
        userId,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        profile.email,
      ]
    );

    res.redirect(`${clientUrl}/settings?google=connected&account=${encodeURIComponent(profile.email)}`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${clientUrl}/settings?google=error`);
  }
});

// Status — is this user connected?
router.get('/status', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT google_email, updated_at FROM google_tokens WHERE user_id = $1',
    [req.user.id]
  );
  res.json({ connected: rows.length > 0, google_email: rows[0]?.google_email || null });
});

// Disconnect
router.delete('/disconnect', auth, async (req, res) => {
  await pool.query('DELETE FROM google_tokens WHERE user_id = $1', [req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
