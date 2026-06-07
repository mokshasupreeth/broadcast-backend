const express        = require('express');
const router         = express.Router();
const bcrypt         = require('bcryptjs');
const { db, userQueries, uuidv4 } = require('../models/Db');
const { sendOTP }    = require('../services/email');
const { sendSMSOTP } = require('../services/sms');

const otpInsert   = db.prepare('INSERT INTO otp_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)');
const otpFind     = db.prepare('SELECT * FROM otp_codes WHERE email = ? AND code = ? AND used = 0 ORDER BY expires_at DESC LIMIT 1');
const otpMarkUsed = db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?');
const updatePassword = db.prepare('UPDATE users SET password = ? WHERE email = ?');

// POST /api/forgot/send-otp  (email)
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = userQueries.findByEmail.get(email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'No account found with this email' });

  const otp        = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = Date.now() + 10 * 60 * 1000;

  otpInsert.run(uuidv4(), email.toLowerCase(), otp, expires_at);

  try {
    await sendOTP(email, otp);
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send OTP email' });
  }
});

// POST /api/forgot/verify-otp  (email)
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  const record = otpFind.get(email.toLowerCase(), otp);
  if (!record) return res.status(400).json({ error: 'Invalid OTP' });
  if (Date.now() > record.expires_at) return res.status(400).json({ error: 'OTP expired' });

  res.json({ success: true, message: 'OTP verified' });
});

// POST /api/forgot/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const record = otpFind.get(email.toLowerCase(), otp);
  if (!record) return res.status(400).json({ error: 'Invalid OTP' });
  if (Date.now() > record.expires_at) return res.status(400).json({ error: 'OTP expired' });

  const hash = await bcrypt.hash(newPassword, 10);
  updatePassword.run(hash, email.toLowerCase());
  otpMarkUsed.run(record.id);

  res.json({ success: true, message: 'Password reset successfully' });
});

// POST /api/forgot/send-sms-otp
router.post('/send-sms-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const otp        = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = Date.now() + 10 * 60 * 1000;
  const email      = `phone_${phone}`;  // reuse otp_codes table with phone key

  otpInsert.run(uuidv4(), email, otp, expires_at);

  try {
    await sendSMSOTP(phone, otp);
    res.json({ success: true, message: 'OTP sent to your phone' });
  } catch (err) {
    console.error('SMS OTP Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to send SMS OTP' });
  }
});

// POST /api/forgot/verify-sms-otp
// POST /api/forgot/verify-sms-otp
router.post('/verify-sms-otp', (req, res) => {

  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({
      error: 'Phone and OTP required'
    });
  }

  const cleanPhone =
    phone
      .replace(/^\+91|^91/, '')
      .replace(/\D/g, '');

  const email =
    `phone_${cleanPhone}`;

  const record =
    otpFind.get(
      email,
      otp
    );

  if (!record) {
    return res.status(400).json({
      error: 'Invalid OTP'
    });
  }

  if (
    Date.now() >
    record.expires_at
  ) {
    return res.status(400).json({
      error: 'OTP expired'
    });
  }

  otpMarkUsed.run(
    record.id
  );

  res.json({
    success: true,
    message: 'Phone verified'
  });

});