const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'broadcast_secret_key';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Malformed token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function memberOnly(req, res, next) {
  if (req.user?.role !== 'member') return res.status(403).json({ error: 'Member access required' });
  next();
}

module.exports = { authMiddleware, adminOnly, memberOnly };