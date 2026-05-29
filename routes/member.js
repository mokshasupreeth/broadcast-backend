const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const {
  db,
  userQueries,
  messageQueries,
  receiptQueries,
  groupQueries,
  uuidv4
} = require('../models/Db');
const { authMiddleware } = require('../middleware/auth');

// ======================
// UPLOADS
// ======================
if (!fs.existsSync('./public/uploads')) {
  fs.mkdirSync('./public/uploads', { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, './public/uploads/'); },
  filename:    (req, file, cb) => { cb(null, uuidv4() + path.extname(file.originalname)); }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ======================
// GET MEMBER MESSAGES
// ======================
router.get('/messages', authMiddleware, (req, res) => {
  try {
    const userId   = req.user.id;
    const messages = messageQueries.findForUser
      .all(userId, userId, userId)
      .map((m) => {
        const receipt = receiptQueries.isRead.get(m.id, userId);
        return {
          ...m,
          delivered: true,
          read:      !!receipt?.read_at,
          readAt:    receipt?.read_at || null,
        };
      });
    res.json(messages);
  } catch (err) {
    console.log('MESSAGES ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ======================
// MARK MESSAGE READ
// ======================
router.post('/messages/:id/read', authMiddleware, (req, res) => {
  try {
    receiptQueries.upsertDelivered.run(req.params.id, req.user.id);
    receiptQueries.markRead.run(req.params.id, req.user.id);
    const io = req.app.get('io');
    io.emit('message_read', { messageId: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    console.log('READ ERROR:', err.message);
    res.status(500).json({ error: 'Failed to mark message read' });
  }
});

// ======================
// MEMBER GROUPS
// ======================
router.get('/groups', authMiddleware, (req, res) => {
  try {
    const groups = groupQueries.getUserGroups
      .all(req.user.id)
      .map((g) => ({
        ...g,
        members: groupQueries.getMembers.all(g.id),
      }));
    res.json(groups);
  } catch (err) {
    console.log('GROUPS ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// ======================
// GET GROUP MESSAGES
// FIX: insert into group_message_reads so unread count clears
// ======================
router.get('/groups/:groupId/messages', authMiddleware, (req, res) => {
  try {
    const { groupId } = req.params;
    const userId      = req.user.id;

    const membership = db.prepare(`
      SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?
    `).get(groupId, userId);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const messages = db.prepare(`
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.target_type = 'group' AND m.target_id = ?
      ORDER BY m.created_at ASC
    `).all(groupId);

    // FIX: also mark as read in group_message_reads table
    // so that chat.js GET /groups unread count query works correctly
    const markRead = db.prepare(`
      INSERT OR IGNORE INTO group_message_reads (message_id, user_id, read_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    messages.forEach((msg) => {
      if (msg.sender_id !== userId) {
        markRead.run(msg.id, userId);
      }
    });

    res.json(messages);
  } catch (err) {
    console.log('GROUP MESSAGE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
});

// ======================
// SEND GROUP MESSAGE
// ======================
router.post('/groups/:groupId/messages', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId      = req.user.id;

    const membership = db.prepare(`
      SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?
    `).get(groupId, userId);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const { body } = req.body;
    if (!body && !req.file) return res.status(400).json({ error: 'Message or file required' });

    const io          = req.app.get('io');
    const connected   = req.app.get('connectedMembers');
    const transporter = req.app.get('transporter');
    const sender      = userQueries.findById.get(userId);
    const group       = groupQueries.findById.get(groupId);

    const msgId        = uuidv4();
    const fileName     = req.file ? req.file.filename     : null;
    const fileOriginal = req.file ? req.file.originalname : null;
    const fileMime     = req.file ? req.file.mimetype     : null;
    const fileSize     = req.file ? req.file.size         : null;
    const fileUrl      = req.file ? '/uploads/' + req.file.filename : null;

    messageQueries.insert.run(
      msgId, sender.name, body || '', userId,
      'group', groupId,
      fileName, fileOriginal, fileMime, fileSize, fileUrl
    );

    const msg = db.prepare(`
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(msgId);

    const groupMembers = groupQueries.getMembers.all(groupId);

    groupMembers.forEach((m) => {
      receiptQueries.upsertDelivered.run(msgId, m.id);
      const sid = connected.get(m.id);
      if (sid) {
        io.to(sid).emit('new_group_message', { groupId, message: msg });
      }
    });

    io.emit('member_group_message', {
      groupId,
      groupName: group.name,
      sender:    sender.name,
      message:   msg,
    });

    const admin = db.prepare(`SELECT email FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (admin && transporter) {
      try {
        await transporter.sendMail({
          from:    process.env.EMAIL_USER,
          to:      admin.email,
          subject: `💬 Group message from ${sender.name}`,
          html: `
            <div style="font-family:Arial;padding:20px;">
              <h2>New Group Message</h2>
              <p><b>Group:</b> ${group.name}</p>
              <p><b>From:</b> ${sender.name}</p>
              <p>${body || '(file only)'}</p>
            </div>
          `,
        });
      } catch (err) {
        console.log('EMAIL ERROR:', err.message);
      }
    }

    res.json({ success: true, message: msg });
  } catch (err) {
    console.log('GROUP SEND ERROR:', err.message);
    res.status(500).json({ error: 'Failed to send group message' });
  }
});

// ======================
// GET DM WITH ADMIN
// ======================
router.get('/dm', authMiddleware, (req, res) => {
  try {
    const userId   = req.user.id;
    const messages = db.prepare(`
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE
        (m.target_type = 'user' AND m.target_id = ?)
        OR (m.sender_id = ? AND m.target_type = 'admin_reply')
      ORDER BY m.created_at ASC
    `).all(userId, userId);
    res.json(messages);
  } catch (err) {
    console.log('DM FETCH ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch DM' });
  }
});

// ======================
// SEND DM TO ADMIN
// ======================
router.post('/dm', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const userId      = req.user.id;
    const { body }    = req.body;
    if (!body && !req.file) return res.status(400).json({ error: 'Message or file required' });

    const io          = req.app.get('io');
    const transporter = req.app.get('transporter');
    const sender      = userQueries.findById.get(userId);

    const msgId        = uuidv4();
    const fileName     = req.file ? req.file.filename     : null;
    const fileOriginal = req.file ? req.file.originalname : null;
    const fileMime     = req.file ? req.file.mimetype     : null;
    const fileSize     = req.file ? req.file.size         : null;
    const fileUrl      = req.file ? '/uploads/' + req.file.filename : null;

    messageQueries.insert.run(
      msgId, sender.name, body || '', userId,
      'admin_reply', null,
      fileName, fileOriginal, fileMime, fileSize, fileUrl
    );

    const msg = db.prepare(`
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(msgId);

    io.emit('member_dm', { senderId: userId, senderName: sender.name, message: msg });

    const admin = db.prepare(`SELECT email FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (admin && transporter) {
      try {
        await transporter.sendMail({
          from:    process.env.EMAIL_USER,
          to:      admin.email,
          subject: `📩 DM from ${sender.name}`,
          html: `
            <div style="font-family:Arial;padding:20px;">
              <h2>New Member DM</h2>
              <p><b>From:</b> ${sender.name}</p>
              <p>${body || '(file only)'}</p>
            </div>
          `,
        });
      } catch (err) {
        console.log('EMAIL ERROR:', err.message);
      }
    }

    res.json({ success: true, message: msg });
  } catch (err) {
    console.log('DM SEND ERROR:', err.message);
    res.status(500).json({ error: 'Failed to send DM' });
  }
});

// ======================
// UPDATE PROFILE
// ======================
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { name, username } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const existing = db.prepare(`
      SELECT id FROM users WHERE username = ? AND id != ?
    `).get(username, req.user.id);

    if (existing) return res.status(409).json({ error: 'Username already taken' });

    db.prepare(`UPDATE users SET name = ?, username = ? WHERE id = ?`)
      .run(name, username, req.user.id);

    res.json({ success: true });
  } catch (err) {
    console.log('PROFILE ERROR:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ======================
// GET PRIVATE CHAT
// FIX: insert into private_message_reads so unread count clears
// ======================
router.get('/private/:userId', authMiddleware, (req, res) => {
  try {
    const currentUser = req.user.id;
    const otherUser   = req.params.userId;

    const messages = db.prepare(`
      SELECT m.*, u.name as sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE
        (m.sender_id = ? AND m.target_id = ? AND m.target_type = 'private')
        OR
        (m.sender_id = ? AND m.target_id = ? AND m.target_type = 'private')
      ORDER BY m.created_at ASC
    `).all(currentUser, otherUser, otherUser, currentUser);

    // FIX: mark messages sent by the other person as read
    // so that chat.js GET /chats unread count query works correctly
    const markRead = db.prepare(`
      INSERT OR IGNORE INTO private_message_reads (message_id, user_id, read_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    messages.forEach((msg) => {
      if (msg.sender_id !== currentUser) {
        markRead.run(msg.id, currentUser);
      }
    });

    res.json(messages);
  } catch (err) {
    console.log('PRIVATE CHAT ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch private chat' });
  }
});

// ======================
// SEND PRIVATE MESSAGE
// ======================
router.post('/private/:userId', authMiddleware, async (req, res) => {
  try {
    const senderId   = req.user.id;
    const receiverId = req.params.userId;
    const { body }   = req.body;
    if (!body) return res.status(400).json({ error: 'Message required' });

    const msgId = uuidv4();
    messageQueries.insert.run(
      msgId, 'Private Message', body, senderId,
      'private', receiverId,
      null, null, null, null, null
    );
    receiptQueries.upsertDelivered.run(msgId, receiverId);

    const msg = db.prepare(`
      SELECT m.*, u.name as sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `).get(msgId);

    const io        = req.app.get('io');
    const connected = req.app.get('connectedMembers');
    const sid       = connected.get(receiverId);
    if (sid) { io.to(sid).emit('private_message', msg); }

    res.json({ success: true, message: msg });
  } catch (err) {
    console.log('PRIVATE SEND ERROR:', err.message);
    res.status(500).json({ error: 'Failed to send private message' });
  }
});

// ======================
// EXPORT
// ======================
module.exports = router;