const express = require('express');
const router = express.Router();
const { messageQueries, receiptQueries, groupQueries } = require('../models/db');
const { authMiddleware, memberOnly } = require('../middleware/auth');

// GET /api/member/messages - full history
router.get('/messages', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const messages = messageQueries.findForUser.all(userId, userId).map(m => {
    const receipt = receiptQueries.isRead.get(m.id, userId);
    return {
      ...m,
      delivered: true,
      read: !!(receipt?.read_at),
      readAt: receipt?.read_at || null
    };
  });
  res.json(messages);
});

// POST /api/member/messages/:id/read
router.post('/messages/:id/read', authMiddleware, (req, res) => {
  receiptQueries.upsertDelivered.run(req.params.id, req.user.id);
  receiptQueries.markRead.run(req.params.id, req.user.id);
  const io = req.app.get('io');
  io.emit('message_read', { messageId: req.params.id, userId: req.user.id });
  res.json({ success: true });
});

// GET /api/member/groups
router.get('/groups', authMiddleware, (req, res) => {
  res.json(groupQueries.getUserGroups.all(req.user.id));
});

module.exports = router;