const router = require('express').Router();
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { makeOAuthClient } = require('../services/googleCalendar');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

// Step 1 — redirect to Google. The client POSTs to get a URL (avoids token in redirect header).
router.get('/connect-url', auth, (req, res) => {
  const oauth2 = makeOAuthClient();
  const state = Buffer.from(
    JSON.stringify({ token: req.headers.authorization?.slice(7) })
  ).toString('base64');
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
  res.json({ url });
});

// Step 2 — Google redirects back here with a code.
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  const clientUrl = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')[0]
    .trim();

  if (error) {
    return res.redirect(`${clientUrl}/settings?google=denied`);
  }

  let userId;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
    const verified = jwt.verify(decoded.token, process.env.JWT_SECRET);
    userId = verified.id;
  } catch {
    return res.redirect(`${clientUrl}/settings?google=error`);
  }

  try {
    const oauth2 = makeOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Get the Google account email for display
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
