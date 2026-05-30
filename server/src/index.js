require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const migrate = require('./db/migrate');
const pool = require('./db/pool');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsOrigin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Not allowed by CORS'));
}

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
});

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/meetings', require('./routes/meetings'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

// ── Socket.io real-time layer ──────────────────────────────────────────────

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Join a workspace room to receive real-time updates
  socket.on('join:workspace', (workspaceId) => {
    socket.join(`ws:${workspaceId}`);
  });

  socket.on('leave:workspace', (workspaceId) => {
    socket.leave(`ws:${workspaceId}`);
  });

  // Broadcast note changes to everyone in the workspace room
  socket.on('note:update', async ({ workspaceId, note }) => {
    try {
      // Verify membership before broadcasting
      const { rows } = await pool.query(
        'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, socket.user.id]
      );
      if (!rows.length) return;
      socket.to(`ws:${workspaceId}`).emit('note:updated', note);
    } catch (err) {
      console.error('socket note:update error', err);
    }
  });

  socket.on('meeting:update', async ({ workspaceId, meeting }) => {
    try {
      const { rows } = await pool.query(
        'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, socket.user.id]
      );
      if (!rows.length) return;
      socket.to(`ws:${workspaceId}`).emit('meeting:updated', meeting);
    } catch (err) {
      console.error('socket meeting:update error', err);
    }
  });

  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 4000;

migrate()
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on :${PORT}`));
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
