const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbDir = path.dirname(process.env.DB_PATH || './data/broadcast.db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(process.env.DB_PATH || './data/broadcast.db');

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── SCHEMA ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    approved INTEGER NOT NULL DEFAULT 0,
    avatar TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS join_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS groups_table (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups_table(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT,
    sender_id TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'all',
    target_id TEXT,
    file_name TEXT,
    file_original TEXT,
    file_mime TEXT,
    file_size INTEGER,
    file_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS message_receipts (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    delivered_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT,
    PRIMARY KEY (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    user_id TEXT PRIMARY KEY,
    subscription TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── SEED ADMIN ───────────────────────────────────────────────────────────
const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('Admin@123', 10);
  db.prepare(`INSERT INTO users (id, name, email, username, password, role, approved) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'Admin', 'admin@broadcast.app', 'admin', hash, 'admin', 1);
  console.log('✅ Admin seeded: admin / Admin@123');
}

// ── USER QUERIES ─────────────────────────────────────────────────────────
const userQueries = {
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  findAll: db.prepare('SELECT id, name, email, username, role, approved, created_at FROM users'),
  findMembers: db.prepare('SELECT id, name, email, username, role, approved, created_at FROM users WHERE role = ?'),
  findApproved: db.prepare('SELECT id, name, email, username, role, approved, created_at FROM users WHERE role = ? AND approved = 1'),
  insert: db.prepare('INSERT INTO users (id, name, email, username, password, role, approved) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  approve: db.prepare('UPDATE users SET approved = 1 WHERE id = ?'),
  countApprovedMembers: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ? AND approved = 1')
};

// ── JOIN REQUEST QUERIES ─────────────────────────────────────────────────
const requestQueries = {
  findByUser: db.prepare('SELECT * FROM join_requests WHERE user_id = ? ORDER BY requested_at DESC LIMIT 1'),
  findPending: db.prepare(`
    SELECT jr.*, u.name, u.email, u.username FROM join_requests jr
    JOIN users u ON jr.user_id = u.id WHERE jr.status = 'pending' ORDER BY jr.requested_at ASC
  `),
  findAll: db.prepare(`
    SELECT jr.*, u.name, u.email, u.username FROM join_requests jr
    JOIN users u ON jr.user_id = u.id ORDER BY jr.requested_at DESC
  `),
  insert: db.prepare('INSERT INTO join_requests (id, user_id, status) VALUES (?, ?, ?)'),
  updateStatus: db.prepare('UPDATE join_requests SET status = ?, reviewed_at = datetime(\'now\') WHERE id = ?'),
  countPending: db.prepare('SELECT COUNT(*) as count FROM join_requests WHERE status = ?')
};

// ── GROUP QUERIES ─────────────────────────────────────────────────────────
const groupQueries = {
  findAll: db.prepare('SELECT * FROM groups_table ORDER BY created_at DESC'),
  findById: db.prepare('SELECT * FROM groups_table WHERE id = ?'),
  insert: db.prepare('INSERT INTO groups_table (id, name, description, created_by) VALUES (?, ?, ?, ?)'),
  delete: db.prepare('DELETE FROM groups_table WHERE id = ?'),
  getMembers: db.prepare(`
    SELECT u.id, u.name, u.email, u.username FROM group_members gm
    JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?
  `),
  addMember: db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)'),
  removeMember: db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?'),
  getUserGroups: db.prepare(`
    SELECT g.* FROM groups_table g
    JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?
  `)
};

// ── MESSAGE QUERIES ──────────────────────────────────────────────────────
const messageQueries = {
  insert: db.prepare(`
    INSERT INTO messages (id, title, body, sender_id, target_type, target_id, file_name, file_original, file_mime, file_size, file_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  findAll: db.prepare('SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id ORDER BY m.created_at DESC'),
  findForUser: db.prepare(`
    SELECT m.*, u.name as sender_name FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.target_type = 'all'
       OR (m.target_type = 'user' AND m.target_id = ?)
       OR (m.target_type = 'group' AND m.target_id IN (
            SELECT group_id FROM group_members WHERE user_id = ?
          ))
    ORDER BY m.created_at DESC
  `),
  findById: db.prepare('SELECT * FROM messages WHERE id = ?'),
  countTotal: db.prepare('SELECT COUNT(*) as count FROM messages'),
  findUnreadTargets: db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email FROM users u
    JOIN message_receipts mr ON u.id = mr.user_id
    WHERE mr.message_id = ? AND mr.read_at IS NULL AND u.role = 'member'
  `)
};

// ── RECEIPT QUERIES ──────────────────────────────────────────────────────
const receiptQueries = {
  upsertDelivered: db.prepare('INSERT OR IGNORE INTO message_receipts (message_id, user_id) VALUES (?, ?)'),
  markRead: db.prepare('UPDATE message_receipts SET read_at = datetime(\'now\') WHERE message_id = ? AND user_id = ?'),
  getForMessage: db.prepare(`
    SELECT mr.*, u.name, u.email FROM message_receipts mr
    JOIN users u ON mr.user_id = u.id WHERE mr.message_id = ?
  `),
  getReadCount: db.prepare('SELECT COUNT(*) as count FROM message_receipts WHERE message_id = ? AND read_at IS NOT NULL'),
  getDeliveredCount: db.prepare('SELECT COUNT(*) as count FROM message_receipts WHERE message_id = ?'),
  isRead: db.prepare('SELECT read_at FROM message_receipts WHERE message_id = ? AND user_id = ?')
};

// ── PUSH QUERIES ──────────────────────────────────────────────────────────
const pushQueries = {
  upsert: db.prepare('INSERT OR REPLACE INTO push_subscriptions (user_id, subscription) VALUES (?, ?)'),
  delete: db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?'),
  findAll: db.prepare('SELECT * FROM push_subscriptions'),
  findByUser: db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
};

// ── ANALYTICS ────────────────────────────────────────────────────────────
const analyticsQueries = {
  totalUsers: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?'),
  approvedUsers: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ? AND approved = 1'),
  totalMessages: db.prepare('SELECT COUNT(*) as count FROM messages'),
  totalReads: db.prepare('SELECT COUNT(*) as count FROM message_receipts WHERE read_at IS NOT NULL'),
  totalDelivered: db.prepare('SELECT COUNT(*) as count FROM message_receipts'),
  pendingRequests: db.prepare('SELECT COUNT(*) as count FROM join_requests WHERE status = ?'),
  recentMessages: db.prepare('SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id ORDER BY m.created_at DESC LIMIT 5'),
  messageStats: db.prepare(`
    SELECT m.id, m.title, m.created_at,
      COUNT(CASE WHEN mr.read_at IS NOT NULL THEN 1 END) as read_count,
      COUNT(mr.user_id) as delivered_count
    FROM messages m LEFT JOIN message_receipts mr ON m.id = mr.message_id
    GROUP BY m.id ORDER BY m.created_at DESC LIMIT 10
  `)
};

module.exports = {
  db,
  userQueries, requestQueries, groupQueries,
  messageQueries, receiptQueries, pushQueries, analyticsQueries,
  uuidv4
};