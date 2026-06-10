require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ── Upload dir ────────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Socket setup ──────────────────────────────────────────────────────────────
const connectedMembers = new Map();
app.set('connectedMembers', connectedMembers);
app.set('io', io);

function setUserOnline(userId, online) {
  try {
    const { userProfileQueries } = require('./models/Db');
    const user = userProfileQueries.findByUserId.get(userId);
    if (!user) {
      userProfileQueries.upsert.run(
        userId, null, 'Hey there! I am using Broadcast.', null, online ? 1 : 0
      );
    } else {
      userProfileQueries.updateOnline.run(online ? 1 : 0, userId);
    }
  } catch (e) { console.log(e.message); }
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  // ── Join ──────────────────────────────────────────────────────────────────
  socket.on('join', ({ userId, role }) => {
    socket.userId = userId;
    socket.role   = role;
    socket.join(`user:${userId}`);
    connectedMembers.set(userId, socket.id);
    setUserOnline(userId, true);
  });

  // ── Group join ────────────────────────────────────────────────────────────
  socket.on('join_group', ({ groupId }) => {
    socket.join(`group:${groupId}`);
  });

  // ── Typing ────────────────────────────────────────────────────────────────
  socket.on('typing', ({ chatId, chatType, toUserId }) => {
    const payload = { chatId, userId: socket.userId };
    if (chatType === 'private') io.to(`user:${toUserId}`).emit('typing', payload);
    else socket.to(`group:${chatId}`).emit('typing', payload);
  });

  socket.on('stop_typing', ({ chatId, chatType, toUserId }) => {
    const payload = { chatId, userId: socket.userId };
    if (chatType === 'private') io.to(`user:${toUserId}`).emit('stop_typing', payload);
    else socket.to(`group:${chatId}`).emit('stop_typing', payload);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedMembers.delete(socket.userId);
      setUserOnline(socket.userId, false);
    }
  });

  // ── WebRTC Calling ────────────────────────────────────────────────────────
  socket.on('call_user', ({ toUserId, fromUserId, fromName, callType, offer }) => {
    io.to(`user:${toUserId}`).emit('incoming_call', {
      fromUserId, fromName, callType, offer
    });
  });

  socket.on('call_accepted', ({ toUserId, answer }) => {
    io.to(`user:${toUserId}`).emit('call_accepted', { answer });
  });

  socket.on('call_rejected', ({ toUserId }) => {
    io.to(`user:${toUserId}`).emit('call_rejected');
  });

  socket.on('call_ended', ({ toUserId }) => {
    io.to(`user:${toUserId}`).emit('call_ended');
  });

  socket.on('ice_candidate', ({ toUserId, candidate }) => {
    io.to(`user:${toUserId}`).emit('ice_candidate', { candidate });
  });
  // ── End WebRTC ────────────────────────────────────────────────────────────
});

// ── Message Scheduler ─────────────────────────────────────────────────────────
setInterval(async () => {
  try {
    const { db, userQueries } = require('./models/Db');
    const due = db.prepare(`
      SELECT * FROM messages
      WHERE scheduled_at IS NOT NULL
      AND scheduled_at <= datetime('now')
      AND (delivered = 0 OR delivered IS NULL)
    `).all();

    for (const msg of due) {
      db.prepare('UPDATE messages SET scheduled_at = NULL WHERE id = ?').run(msg.id);
      const approvedMembers = userQueries.findApproved.all('member');
      approvedMembers.forEach(member => {
        io.to(`user:${member.id}`).emit('new_broadcast', msg);
      });
      console.log(`✅ Scheduled message sent: ${msg.title}`);
    }
  } catch (e) {
    console.log('Scheduler error:', e.message);
  }
}, 60000);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Broadcast Backend Running' });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/member', require('./routes/member'));
app.use('/api/forgot', require('./routes/forgot'));
app.use('/api/admin',  require('./routes/admin'));
app.use('/api/chat',   require('./routes/chat'));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));