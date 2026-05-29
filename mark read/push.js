const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const store = require('../models/store');
const { authMiddleware } = require('../middleware/auth');

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || null;
  res.json({ publicKey: key });
});

// POST /api/push/subscribe
router.post('/subscribe', authMiddleware, (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription required' });
  store.addPushSubscription(req.user.id, subscription);
  res.json({ success: true });
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', authMiddleware, (req, res) => {
  store.pushSubscriptions = store.pushSubscriptions.filter(s => s.userId !== req.user.id);
  res.json({ success: true });
});

module.exports = router;