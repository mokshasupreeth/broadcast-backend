const express = require('express');
const router = express.Router();
const store = require('../models/store');
const { authMiddleware } = require('../middleware/auth');

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

router.post('/subscribe', authMiddleware, (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription required' });
  store.addPushSubscription(req.user.id, subscription);
  res.json({ success: true });
});

router.delete('/unsubscribe', authMiddleware, (req, res) => {
  store.pushSubscriptions = store.pushSubscriptions.filter(s => s.userId !== req.user.id);
  res.json({ success: true });
});

module.exports = router;
