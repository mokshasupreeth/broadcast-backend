const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  userQueries, requestQueries, groupQueries,
  messageQueries, receiptQueries, analyticsQueries, uuidv4
} = require('../models/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './public/uploads/'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── ANALYTICS ────────────────────────────────────────────────────────────
router.get('/analytics', authMiddleware, adminOnly, (req, res) => {
  const connected = req.app.get('connectedMembers');
  const totalMembers = analyticsQueries.totalUsers.get('member').count;
  const approvedMembers = analyticsQueries.approvedUsers.get('member').count;
  const totalMessages = analyticsQueries.totalMessages.get().count;
  const totalReads = analyticsQueries.totalReads.get().count;
  const totalDelivered = analyticsQueries.totalDelivered.get().count;
  const pending = analyticsQueries.pendingRequests.get('pending').count;
  const recentMessages = analyticsQueries.recentMessages.all();
  const messageStats = analyticsQueries.messageStats.all();

  res.json({
    totalMembers, approvedMembers,
    onlineMembers: connected.size,
    totalMessages, totalReads, totalDelivered,
    pendingRequests: pending,
    readRate: totalDelivered > 0 ? Math.round((totalReads / totalDelivered) * 100) : 0,
    recentMessages, messageStats
  });
});

// ── MEMBERS ──────────────────────────────────────────────────────────────
router.get('/members', authMiddleware, adminOnly, (req, res) => {
  const connected = req.app.get('connectedMembers');
  const members = userQueries.findApproved.all('member').map(m => ({
    ...m, online: connected.has(m.id)
  }));
  res.json(members);
});

router.get('/members/all', authMiddleware, adminOnly, (req, res) => {
  const connected = req.app.get('connectedMembers');
  const members = userQueries.findMembers.all('member').map(m => ({
    ...m, online: connected.has(m.id)
  }));
  res.json(members);
});

// ── JOIN REQUESTS ─────────────────────────────────────────────────────────
router.get('/join-requests', authMiddleware, adminOnly, (req, res) => {
  res.json(requestQueries.findAll.all());
});

router.post('/join-requests/:id/approve', authMiddleware, adminOnly, (req, res) => {
  const reqRow = requestQueries.findByUser.get(req.params.id);
  // Find by request id
  const allReqs = requestQueries.findAll.all();
  const found = allReqs.find(r => r.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  requestQueries.updateStatus.run('approved', req.params.id);
  userQueries.approve.run(found.user_id);
  const io = req.app.get('io');
  io.emit('request_decision', { userId: found.user_id, status: 'approved' });
  res.json({ success: true });
});

router.post('/join-requests/:id/reject', authMiddleware, adminOnly, (req, res) => {
  const allReqs = requestQueries.findAll.all();
  const found = allReqs.find(r => r.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  requestQueries.updateStatus.run('rejected', req.params.id);
  const io = req.app.get('io');
  io.emit('request_decision', { userId: found.user_id, status: 'rejected' });
  res.json({ success: true });
});

// ── GROUPS ────────────────────────────────────────────────────────────────
router.get('/groups', authMiddleware, adminOnly, (req, res) => {
  const groups = groupQueries.findAll.all().map(g => ({
    ...g, members: groupQueries.getMembers.all(g.id)
  }));
  res.json(groups);
});

router.post('/groups', authMiddleware, adminOnly, (req, res) => {
  const { name, description, memberIds } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name required' });
  const id = uuidv4();
  groupQueries.insert.run(id, name, description || '', req.user.id);
  if (Array.isArray(memberIds)) {
    memberIds.forEach(uid => groupQueries.addMember.run(id, uid));
  }
  res.json({ success: true, id });
});

router.post('/groups/:id/members', authMiddleware, adminOnly, (req, res) => {
  const { userId } = req.body;
  groupQueries.addMember.run(req.params.id, userId);
  res.json({ success: true });
});

router.delete('/groups/:id/members/:userId', authMiddleware, adminOnly, (req, res) => {
  groupQueries.removeMember.run(req.params.id, req.params.userId);
  res.json({ success: true });
});

router.delete('/groups/:id', authMiddleware, adminOnly, (req, res) => {
  groupQueries.delete.run(req.params.id);
  res.json({ success: true });
});

// ── MESSAGES ──────────────────────────────────────────────────────────────
router.get('/messages', authMiddleware, adminOnly, (req, res) => {
  const messages = messageQueries.findAll.all().map(m => {
    const readCount = receiptQueries.getReadCount.get(m.id).count;
    const deliveredCount = receiptQueries.getDeliveredCount.get(m.id).count;
    return { ...m, readCount, deliveredCount, unreadCount: deliveredCount - readCount };
  });
  res.json(messages);
});

router.get('/messages/:id/receipts', authMiddleware, adminOnly, (req, res) => {
  res.json(receiptQueries.getForMessage.all(req.params.id));
});

// Get users who haven't read a specific message (for retargeting)
router.get('/messages/:id/unread-users', authMiddleware, adminOnly, (req, res) => {
  res.json(messageQueries.findUnreadTargets.all(req.params.id, req.params.id));
});

router.post('/messages', authMiddleware, adminOnly, upload.single('file'), (req, res) => {
  const { title, body, targetType, targetId } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const io = req.app.get('io');
  const connected = req.app.get('connectedMembers');

  const msgId = uuidv4();
  messageQueries.insert.run(
    msgId, title, body || '', req.user.id,
    targetType || 'all', targetId || null,
    req.file ? req.file.filename : null,
    req.file ? req.file.originalname : null,
    req.file ? req.file.mimetype : null,
    req.file ? req.file.size : null,
    req.file ? `/uploads/${req.file.filename}` : null
  );

  const msg = messageQueries.findById.get(msgId);

  // Create delivery receipts + emit to relevant sockets
  const approvedMembers = userQueries.findApproved.all('member');

  if (targetType === 'all') {
    approvedMembers.forEach(m => {
      receiptQueries.upsertDelivered.run(msgId, m.id);
      const sid = connected.get(m.id);
      if (sid) io.to(sid).emit('new_message', msg);
    });
  } else if (targetType === 'user' && targetId) {
    receiptQueries.upsertDelivered.run(msgId, targetId);
    const sid = connected.get(targetId);
    if (sid) io.to(sid).emit('new_message', msg);
  } else if (targetType === 'group' && targetId) {
    const gMembers = groupQueries.getMembers.all(targetId);
    gMembers.forEach(m => {
      receiptQueries.upsertDelivered.run(msgId, m.id);
      const sid = connected.get(m.id);
      if (sid) io.to(sid).emit('new_message', msg);
    });
  }

  // Notify admin panel too
  io.emit('message_sent', { ...msg, readCount: 0, deliveredCount: approvedMembers.length });

  res.json({ success: true, message: msg });
});

module.exports = router;