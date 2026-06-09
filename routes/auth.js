const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const {
  db,
  userQueries,
  requestQueries,
  uuidv4
} = require('../models/Db');

const {
  authMiddleware
} = require('../middleware/auth');

const {
  validatePassword,
  validateEmail
} = require('../middleware/validate');

const SECRET =
  process.env.JWT_SECRET ||
  'broadcast_secret_key';

// ======================
// EMAIL TRANSPORTER
// ======================

const transporter =
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

// ======================
// REGISTER
// ======================

router.post('/register', async (req, res) => {
  try {
    const { name, email, username, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const emailErr = validateEmail(email);
    if (emailErr) {
      return res.status(400).json({ error: emailErr });
    }

    if (!username || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    const passErr = validatePassword(password);
    if (passErr) {
      return res.status(400).json({ error: passErr });
    }

    // EMAIL EXISTS
    const existingEmail = userQueries.findByEmail.get(email.toLowerCase());
    if (existingEmail) {
      const lastReq = requestQueries.findByUser.get(existingEmail.id);
      if (lastReq?.status === 'rejected') {
        db.prepare('DELETE FROM join_requests WHERE user_id = ?').run(existingEmail.id);
        db.prepare('DELETE FROM users WHERE id = ?').run(existingEmail.id);
      } else {
        return res.status(409).json({ error: 'Email already registered' });
      }
    }

    // USERNAME EXISTS
    const existingUsername = userQueries.findByUsername.get(username.toLowerCase());
    if (existingUsername) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // LIMIT MEMBERS
    const totalMembers = userQueries.findMembers.all('member');
    if (totalMembers.length >= 50) {
      return res.status(400).json({ error: 'Member limit reached (50 max)' });
    }

    // HASH PASSWORD
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    // CREATE USER
    userQueries.insert.run(
  id,
  name.trim(),
  email.toLowerCase(),
  username.toLowerCase(),
  hash,
  'member',
  0
);

    // CREATE REQUEST
    const requestId = uuidv4();
    requestQueries.insert.run(requestId, id, 'pending');

    // EMAIL ADMIN
    try {
      const admin = db.prepare(
        `SELECT email FROM users WHERE role = 'admin' LIMIT 1`
      ).get();

      if (admin?.email) {
        await transporter.sendMail({
          from: `"Broadcast App" <${process.env.EMAIL_USER}>`,
          to: admin.email,
          subject: '🔔 New Member Registration',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
              <div style="background:#2563EB;padding:24px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;">📡 Broadcast App</h1>
              </div>
              <div style="padding:24px;">
                <h2 style="margin-top:0;color:#0F172A;">New Join Request</h2>
                <p style="color:#475569;font-size:15px;">A new member registered and is waiting for approval.</p>
                <div style="background:#F8FAFC;padding:16px;border-radius:12px;margin-top:16px;">
                  <p><b>Name:</b> ${name.trim()}</p>
                  <p><b>Email:</b> ${email.toLowerCase()}</p>
                  <p><b>Username:</b> @${username.toLowerCase()}</p>
                </div>
              </div>
            </div>
          `
        });
        console.log('✅ Admin registration email sent');
      }
    } catch (emailErr) {
      console.log('❌ ADMIN REGISTER EMAIL ERROR:', emailErr.message);
    }

    res.json({ success: true, message: 'Account created!' });

  } catch (err) {
    console.log('REGISTER ERROR:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ======================
// LOGIN
// ======================

router.post('/login', async (req, res) => {
  try {
    console.log('LOGIN BODY:', req.body);

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = userQueries.findByEmail.get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // APPROVAL CHECK
    if (user.role === 'member' && !user.approved) {
      const lastReq = requestQueries.findByUser.get(user.id);

      if (lastReq?.status === 'pending') {
        return res.status(403).json({
          error: 'pending',
          message: 'Your join request is pending admin approval.'
        });
      }

      if (lastReq?.status === 'rejected') {
        return res.status(403).json({
          error: 'rejected',
          message: 'Your join request was rejected.'
        });
      }
    }

    // TOKEN
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role
      },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    console.log('LOGIN ERROR:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ======================
// CURRENT USER
// ======================

router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = userQueries.findById.get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      approved: user.approved
    });

  } catch (err) {
    console.log('ME ERROR:', err.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;