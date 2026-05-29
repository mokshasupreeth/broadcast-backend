const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  db, userQueries, privateChatQueries,
  privateMessageQueries, groupMessageQueries,
  groupQueries, userProfileQueries, uuidv4
} = require('../models/Db');
const { authMiddleware } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './public/uploads/'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── ONE TIME FIX: Duplicate chats merge ───────────────────────────────────────
const fixDuplicateChats = () => {
  try {
    const duplicates = db.prepare(`
      SELECT a.id as id1, b.id as id2
      FROM private_chats a
      JOIN private_chats b
        ON (a.user1_id = b.user2_id AND a.user2_id = b.user1_id)
      WHERE a.id < b.id
    `).all();

    if (duplicates.length === 0) {
      console.log('✅ No duplicate chats found');
      return;
    }

    console.log(`🔧 Fixing ${duplicates.length} duplicate chats...`);
    duplicates.forEach(({ id1, id2 }) => {
      db.prepare(`UPDATE private_messages SET chat_id = ? WHERE chat_id = ?`).run(id1, id2);
      db.prepare(`UPDATE archived_chats SET chat_id = ? WHERE chat_id = ?`).run(id1, id2);
      db.prepare(`UPDATE pinned_chats SET chat_id = ? WHERE chat_id = ?`).run(id1, id2);
      db.prepare(`DELETE FROM private_chats WHERE id = ?`).run(id2);
      console.log(`✅ Merged chat ${id2} → ${id1}`);
    });
    console.log('✅ Duplicate chats fixed!');
  } catch (e) {
    console.log('Fix error:', e.message);
  }
};

fixDuplicateChats();

// ── PROFILE ───────────────────────────────────────────────────────────────────

router.get('/profile', authMiddleware, (req, res) => {
  let profile = userProfileQueries.findByUserId.get(req.user.id);
  const user = userQueries.findById.get(req.user.id);
  if (!profile) {
    userProfileQueries.upsert.run(req.user.id, null, 'Hey there! I am using Broadcast.', null, 0);
    profile = userProfileQueries.findByUserId.get(req.user.id);
  }
  res.json({ ...user, ...profile });
});

router.put('/profile', authMiddleware, (req, res) => {
  const { about, name } = req.body;
  if (about !== undefined) userProfileQueries.updateAbout.run(about, req.user.id);
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  res.json({ success: true });
});

router.post('/profile/avatar', authMiddleware, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const avatarUrl = `/uploads/${req.file.filename}`;
  const existing = userProfileQueries.findByUserId.get(req.user.id);
  if (!existing) {
    userProfileQueries.upsert.run(req.user.id, avatarUrl, 'Hey there! I am using Broadcast.', null, 0);
  } else {
    userProfileQueries.updateAvatar.run(avatarUrl, req.user.id);
  }
  res.json({ success: true, avatarUrl });
});

// ── USERS ─────────────────────────────────────────────────────────────────────

router.get('/users', authMiddleware, (req, res) => {
  const users = userQueries.findApproved.all('member');
  const enriched = users.map(u => {
    const profile = userProfileQueries.findByUserId.get(u.id);
    return { ...u, ...(profile || {}) };
  });
  res.json(enriched);
});

// ── PRIVATE CHATS ─────────────────────────────────────────────────────────────

router.get('/chats', authMiddleware, (req, res) => {
  const userId = req.user.id;

  // ✅ FIX: userId 5 సార్లు pass చేస్తున్నాం — correct గా other_name వస్తుంది
  const chats = db.prepare(`
    SELECT pc.*,
      CASE WHEN pc.user1_id = ? THEN u2.name ELSE u1.name END as other_name,
      CASE WHEN pc.user1_id = ? THEN u2.id ELSE u1.id END as other_id,
      CASE WHEN pc.user1_id = ? THEN u2.email ELSE u1.email END as other_email
    FROM private_chats pc
    JOIN users u1 ON pc.user1_id = u1.id
    JOIN users u2 ON pc.user2_id = u2.id
    WHERE pc.user1_id = ? OR pc.user2_id = ?
  `).all(userId, userId, userId, userId, userId);

  const enriched = chats.map(chat => {
    const lastMsg = db.prepare(`
      SELECT pm.*, u.name as sender_name FROM private_messages pm
      JOIN users u ON pm.sender_id = u.id
      WHERE pm.chat_id = ? AND pm.deleted_for_everyone = 0
      ORDER BY pm.created_at DESC LIMIT 1
    `).get(chat.id);

    const unread = db.prepare(`
      SELECT COUNT(*) as count FROM private_messages pm
      LEFT JOIN private_message_status pms ON pm.id = pms.message_id AND pms.user_id = ?
      WHERE pm.chat_id = ? AND pm.sender_id != ?
      AND (pms.read_at IS NULL)
      AND pm.deleted_for_everyone = 0
    `).get(userId, chat.id, userId);

    const otherProfile = userProfileQueries.findByUserId.get(chat.other_id);

    return {
      ...chat,
      type: 'private',
      lastMessage: lastMsg,
      unreadCount: unread?.count || 0,
      otherProfile,
    };
  });

  res.json(enriched);
});

// ── ✅ FIXED: POST /chats — no sort, exact user order ────────────────────────
router.post('/chats', authMiddleware, (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId) return res.status(400).json({ error: 'otherUserId required' });

  // Both order combinations check cheyyali
  let chat = db.prepare(`
    SELECT * FROM private_chats
    WHERE (user1_id = ? AND user2_id = ?)
       OR (user1_id = ? AND user2_id = ?)
  `).get(req.user.id, otherUserId, otherUserId, req.user.id);

  if (!chat) {
    const id = uuidv4();
    // ✅ .sort() తీసేశాం — logged-in user ఎప్పుడూ user1_id గా save అవుతాడు
    db.prepare(`
      INSERT INTO private_chats (id, user1_id, user2_id)
      VALUES (?, ?, ?)
    `).run(id, req.user.id, otherUserId);
    chat = privateChatQueries.findById.get(id);
  }

  res.json(chat);
});

// ── GET messages ──────────────────────────────────────────────────────────────
router.get('/chats/:chatId/messages', authMiddleware, (req, res) => {
  console.log('MESSAGES REQUEST - chatId:', req.params.chatId, 'userId:', req.user.id);

  // ✅ This user aa chat lo belong avutundaa verify cheyyali
  const chat = db.prepare(`
    SELECT * FROM private_chats
    WHERE id = ? AND (user1_id = ? OR user2_id = ?)
  `).get(req.params.chatId, req.user.id, req.user.id);

  console.log('CHAT FOUND:', chat ? `YES — ${chat.user1_id} <-> ${chat.user2_id}` : 'NO - UNAUTHORIZED');

  if (!chat) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const messages = privateMessageQueries.findByChatId.all(req.user.id, req.params.chatId);
  console.log('MESSAGES COUNT:', messages.length);

  messages.forEach(msg => {
    if (msg.sender_id !== req.user.id) {
      privateMessageQueries.markDelivered.run(msg.id, req.user.id);
    }
  });
  res.json(messages);
});

router.post('/chats/:chatId/messages', authMiddleware, upload.single('file'), (req, res) => {
  const { body, replyTo } = req.body;
  const { chatId } = req.params;

  if (!body && !req.file) return res.status(400).json({ error: 'Message or file required' });

  const chat = privateChatQueries.findById.get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  // ✅ Ownership verify
  if (chat.user1_id !== req.user.id && chat.user2_id !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const msgId = uuidv4();
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

  privateMessageQueries.insert.run(
    msgId, chatId, req.user.id,
    body || '', fileUrl,
    req.file?.originalname || null,
    req.file?.mimetype || null,
    replyTo || null
  );

  const msg = db.prepare(`
    SELECT pm.*, u.name as sender_name FROM private_messages pm
    JOIN users u ON pm.sender_id = u.id WHERE pm.id = ?
  `).get(msgId);

  const io = req.app.get('io');
  const otherId = chat.user1_id === req.user.id ? chat.user2_id : chat.user1_id;

  // ✅ Specific users కి మాత్రమే emit — io.emit కాదు
  io.to(`user:${otherId}`).emit('private_message', { chatId, message: msg });
  io.to(`user:${req.user.id}`).emit('private_message', { chatId, message: msg });

  privateMessageQueries.markDelivered.run(msgId, req.user.id);

  try {
    const sender = userQueries.findById.get(req.user.id);
    const receiver = userQueries.findById.get(otherId);
    const transporter = req.app.get('transporter');
    if (transporter && receiver?.email && sender) {
      transporter.sendMail({
        from: `"Broadcast App" <${process.env.EMAIL_USER}>`,
        to: receiver.email,
        subject: `💬 New message from ${sender.name}`,
        html: `<div style="font-family:Arial;padding:20px;"><p><b>${sender.name}</b> sent you a message: ${body || '📎 File'}</p></div>`
      }).catch(() => {});
    }
  } catch (e) {}

  res.json(msg);
});

router.post('/chats/:chatId/messages/:msgId/read', authMiddleware, (req, res) => {
  privateMessageQueries.markDelivered.run(req.params.msgId, req.user.id);
  privateMessageQueries.markRead.run(req.params.msgId, req.user.id);

  const io = req.app.get('io');
  const msg = privateMessageQueries.findById.get(req.params.msgId);
  if (msg) {
    // ✅ Specific sender కి మాత్రమే emit
    io.to(`user:${msg.sender_id}`).emit('message_read', {
      chatId: req.params.chatId,
      messageId: req.params.msgId,
      readBy: req.user.id
    });
  }
  res.json({ success: true });
});

router.delete('/messages/:msgId', authMiddleware, (req, res) => {
  const { deleteFor } = req.body;
  const msg = privateMessageQueries.findById.get(req.params.msgId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  if (deleteFor === 'everyone' && msg.sender_id === req.user.id) {
    privateMessageQueries.deleteForEveryone.run(req.params.msgId);
    const io = req.app.get('io');
    // ✅ Chat members కి మాత్రమే emit
    const chat = privateChatQueries.findById.get(msg.chat_id);
    if (chat) {
      io.to(`user:${chat.user1_id}`).emit('message_deleted', { messageId: req.params.msgId, chatId: msg.chat_id });
      io.to(`user:${chat.user2_id}`).emit('message_deleted', { messageId: req.params.msgId, chatId: msg.chat_id });
    }
  } else {
    privateMessageQueries.deleteForMe.run(req.params.msgId, req.user.id);
  }
  res.json({ success: true });
});

// ── GROUP MESSAGES ────────────────────────────────────────────────────────────

router.get('/groups', authMiddleware, (req, res) => {
  const groups = groupQueries.getUserGroups.all(req.user.id);

  const enriched = groups.map(group => {
    const lastMsg = db.prepare(`
      SELECT gm.*, u.name as sender_name FROM group_messages gm
      JOIN users u ON gm.sender_id = u.id
      WHERE gm.group_id = ? AND gm.deleted_for_everyone = 0
      ORDER BY gm.created_at DESC LIMIT 1
    `).get(group.id);

    const unread = groupMessageQueries.getUnreadCount.get(req.user.id, group.id, req.user.id);
    const members = groupQueries.getMembers.all(group.id);

    return {
      ...group,
      type: 'group',
      lastMessage: lastMsg,
      unreadCount: unread?.count || 0,
      memberCount: members.length,
    };
  });

  res.json(enriched);
});

router.get('/groups/:groupId/messages', authMiddleware, (req, res) => {
  const members = groupQueries.getMembers.all(req.params.groupId);
  const isMember = members.find(m => m.id === req.user.id);
  const isAdmin = req.user.role === 'admin';

  if (!isMember && !isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const messages = groupMessageQueries.findByGroupId.all(req.user.id, req.params.groupId);
  messages.forEach(msg => {
    if (msg.sender_id !== req.user.id) {
      groupMessageQueries.markDelivered.run(msg.id, req.user.id);
    }
  });
  res.json(messages);
});

router.post('/groups/:groupId/messages', authMiddleware, upload.single('file'), (req, res) => {
  const { body, replyTo } = req.body;
  const { groupId } = req.params;

  if (!body && !req.file) return res.status(400).json({ error: 'Message or file required' });

  const members = groupQueries.getMembers.all(groupId);
  const isMember = members.find(m => m.id === req.user.id);
  const isAdmin = req.user.role === 'admin';
  if (!isMember && !isAdmin) return res.status(403).json({ error: 'Not a member of this group' });

  const msgId = uuidv4();
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

  groupMessageQueries.insert.run(
    msgId, groupId, req.user.id,
    body || '', fileUrl,
    req.file?.originalname || null,
    req.file?.mimetype || null,
    replyTo || null
  );

  const msg = db.prepare(`
    SELECT gm.*, u.name as sender_name FROM group_messages gm
    JOIN users u ON gm.sender_id = u.id WHERE gm.id = ?
  `).get(msgId);

  const io = req.app.get('io');
  members.forEach(m => {
    io.to(`user:${m.id}`).emit('group_message', { groupId, message: msg });
    groupMessageQueries.markDelivered.run(msgId, m.id);
  });
  io.to(`user:${req.user.id}`).emit('group_message', { groupId, message: msg });

  try {
    const sender = userQueries.findById.get(req.user.id);
    if (sender.role === 'member') {
      const transporter = req.app.get('transporter');
      const admin = db.prepare(`SELECT email FROM users WHERE role = 'admin' LIMIT 1`).get();
      if (admin && transporter) {
        transporter.sendMail({
          from: `"Broadcast App" <${process.env.EMAIL_USER}>`,
          to: admin.email,
          subject: `💬 New Group Message from ${sender.name}`,
          html: `<div style="font-family:Arial;padding:20px;"><h3>New message in group</h3><p><b>${sender.name}</b> sent: ${body || '📎 File'}</p></div>`
        }).catch(() => {});
      }
    }
  } catch (e) {}

  res.json(msg);
});

router.post('/groups/:groupId/messages/:msgId/read', authMiddleware, (req, res) => {
  groupMessageQueries.markDelivered.run(req.params.msgId, req.user.id);
  groupMessageQueries.markRead.run(req.params.msgId, req.user.id);
  res.json({ success: true });
});

router.delete('/group-messages/:msgId', authMiddleware, (req, res) => {
  const { deleteFor } = req.body;
  const msg = groupMessageQueries.findById.get(req.params.msgId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  if (deleteFor === 'everyone' && msg.sender_id === req.user.id) {
    groupMessageQueries.deleteForEveryone.run(req.params.msgId);
    const io = req.app.get('io');
    // ✅ Group members కి మాత్రమే emit
    const members = groupQueries.getMembers.all(msg.group_id);
    members.forEach(m => {
      io.to(`user:${m.id}`).emit('group_message_deleted', { messageId: req.params.msgId, groupId: msg.group_id });
    });
  }
  res.json({ success: true });
});

// ── REACTIONS ─────────────────────────────────────────────────────────────────

router.post('/reactions', authMiddleware, (req, res) => {
  const { messageId, messageType, emoji, chatId, groupId, otherUserId } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT OR REPLACE INTO message_reactions (id, message_id, message_type, user_id, emoji, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(id, messageId, messageType, req.user.id, emoji);

  const io = req.app.get('io');

  // ✅ io.emit కాదు — specific users కి మాత్రమే
  if (messageType === 'private' && chatId) {
    const chat = privateChatQueries.findById.get(chatId);
    if (chat) {
      io.to(`user:${chat.user1_id}`).emit('reaction', { messageId, userId: req.user.id, emoji });
      io.to(`user:${chat.user2_id}`).emit('reaction', { messageId, userId: req.user.id, emoji });
    }
  } else if (messageType === 'group' && groupId) {
    const members = groupQueries.getMembers.all(groupId);
    members.forEach(m => {
      io.to(`user:${m.id}`).emit('reaction', { messageId, userId: req.user.id, emoji });
    });
  }

  res.json({ success: true });
});

// ── ARCHIVE ───────────────────────────────────────────────────────────────────

router.post('/archive', authMiddleware, (req, res) => {
  const { chatId, chatType } = req.body;
  db.prepare(`INSERT OR IGNORE INTO archived_chats (user_id, chat_id, chat_type) VALUES (?, ?, ?)`).run(req.user.id, chatId, chatType);
  res.json({ success: true });
});

router.delete('/archive', authMiddleware, (req, res) => {
  const { chatId } = req.body;
  db.prepare(`DELETE FROM archived_chats WHERE user_id = ? AND chat_id = ?`).run(req.user.id, chatId);
  res.json({ success: true });
});

router.get('/archived', authMiddleware, (req, res) => {
  const archived = db.prepare(`SELECT * FROM archived_chats WHERE user_id = ?`).all(req.user.id);
  res.json(archived);
});

// ── PIN ───────────────────────────────────────────────────────────────────────

router.post('/pin', authMiddleware, (req, res) => {
  const { chatId, chatType } = req.body;
  db.prepare(`INSERT OR IGNORE INTO pinned_chats (user_id, chat_id, chat_type) VALUES (?, ?, ?)`).run(req.user.id, chatId, chatType);
  res.json({ success: true });
});

router.delete('/pin', authMiddleware, (req, res) => {
  const { chatId } = req.body;
  db.prepare(`DELETE FROM pinned_chats WHERE user_id = ? AND chat_id = ?`).run(req.user.id, chatId);
  res.json({ success: true });
});

// ── DISAPPEARING MESSAGES ─────────────────────────────────────────────────────

router.post('/settings/disappearing', authMiddleware, (req, res) => {
  const { chatId, duration } = req.body;
  db.prepare(`INSERT OR REPLACE INTO pinned_chats (user_id, chat_id, chat_type) VALUES (?, ?, ?)`).run(
    `disappear_${req.user.id}`, chatId, duration.toString()
  );
  res.json({ success: true });
});

module.exports = router;