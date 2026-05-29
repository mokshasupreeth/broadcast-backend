const Database = require('better-sqlite3');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbDir = './data';

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, {
    recursive: true
  });
}

const dbPath = process.env.DB_PATH || './data/broadcast.db';
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ======================
// TABLES
// ======================

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  approved INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (group_id, user_id)
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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_receipts (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    delivered_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT,
    PRIMARY KEY (message_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS private_chats (
    id TEXT PRIMARY KEY,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user1_id, user2_id),
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS private_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    body TEXT,
    file_url TEXT,
    file_name TEXT,
    file_mime TEXT,
    reply_to TEXT,
    deleted_for_everyone INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES private_chats(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS private_message_status (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    delivered_at TEXT DEFAULT (datetime('now')),
    read_at TEXT,
    deleted_for_me INTEGER DEFAULT 0,
    PRIMARY KEY (message_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS group_messages (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    body TEXT,
    file_url TEXT,
    file_name TEXT,
    file_mime TEXT,
    reply_to TEXT,
    deleted_for_everyone INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups_table(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS group_message_status (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    delivered_at TEXT DEFAULT (datetime('now')),
    read_at TEXT,
    deleted_for_me INTEGER DEFAULT 0,
    PRIMARY KEY (message_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    avatar_url TEXT,
    about TEXT DEFAULT 'Hey there! I am using Broadcast.',
    last_seen TEXT,
    is_online INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS message_reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    message_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(message_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS pinned_chats (
    user_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    chat_type TEXT NOT NULL,
    PRIMARY KEY (user_id, chat_id)
  );

  CREATE TABLE IF NOT EXISTS archived_chats (
    user_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    chat_type TEXT NOT NULL,
    PRIMARY KEY (user_id, chat_id)
  );
`);

// ======================
// SEED ADMIN
// ======================

const adminExists = db
  .prepare(
    'SELECT id FROM users WHERE role = ?'
  )
  .get('admin');

if (!adminExists) {

  const hash = bcrypt.hashSync(
    'Admin@123',
    10
  );

  db.prepare(`
    INSERT INTO users
    (
      id,
      name,
      email,
      username,
      password,
      role,
      approved
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    'Admin',
    'bmms201@gmail.com',
    'admin',
    hash,
    'admin',
    1
  );

  console.log('✅ Admin created');
}

// ======================
// USER QUERIES
// ======================

const userQueries = {

  findById: db.prepare(`
    SELECT *
    FROM users
    WHERE id = ?
  `),

  findByEmail: db.prepare(`
    SELECT *
    FROM users
    WHERE email = ?
  `),

  findByUsername: db.prepare(`
    SELECT *
    FROM users
    WHERE username = ?
  `),

  findAll: db.prepare(`
    SELECT
      id,
      name,
      email,
      username,
      role,
      approved,
      created_at
    FROM users
  `),

  findMembers: db.prepare(`
    SELECT
      id,
      name,
      email,
      username,
      role,
      approved,
      created_at
    FROM users
    WHERE role = ?
  `),

  findApproved: db.prepare(`
    SELECT
      id,
      name,
      email,
      username,
      role,
      approved,
      created_at
    FROM users
    WHERE role = ?
    AND approved = 1
  `),

  insert: db.prepare(`
    INSERT INTO users
    (
      id,
      name,
      email,
      username,
      password,
      role,
      approved
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),

  approve: db.prepare(`
    UPDATE users
    SET approved = 1
    WHERE id = ?
  `)
};

// ======================
// REQUEST QUERIES
// ======================

const requestQueries = {

  findByUser: db.prepare(`
    SELECT *
    FROM join_requests
    WHERE user_id = ?
    ORDER BY requested_at DESC
    LIMIT 1
  `),

  findPending: db.prepare(`
    SELECT
      jr.*,
      u.name,
      u.email,
      u.username

    FROM join_requests jr

    JOIN users u
      ON jr.user_id = u.id

    WHERE jr.status = 'pending'

    ORDER BY jr.requested_at ASC
  `),

  findAll: db.prepare(`
    SELECT
      jr.*,
      u.name,
      u.email,
      u.username

    FROM join_requests jr

    JOIN users u
      ON jr.user_id = u.id

    WHERE jr.status = 'pending'

    ORDER BY jr.requested_at DESC
  `),

  insert: db.prepare(`
    INSERT INTO join_requests (
      id,
      user_id,
      status
    )
    VALUES (?, ?, ?)
  `),

  updateStatus: db.prepare(`
    UPDATE join_requests
    SET
      status = ?,
      reviewed_at = datetime('now')
    WHERE id = ?
  `),

  countPending: db.prepare(`
    SELECT COUNT(*) as count
    FROM join_requests
    WHERE status = ?
  `),
};

// ======================
// GROUP QUERIES
// ======================

const groupQueries = {

  findAll: db.prepare(`
    SELECT *
    FROM groups_table
    ORDER BY created_at DESC
  `),

  findById: db.prepare(`
    SELECT *
    FROM groups_table
    WHERE id = ?
  `),

  insert: db.prepare(`
    INSERT INTO groups_table
    (
      id,
      name,
      description,
      created_by
    )
    VALUES (?, ?, ?, ?)
  `),

  delete: db.prepare(`
    DELETE FROM groups_table
    WHERE id = ?
  `),

  getMembers: db.prepare(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.username

    FROM group_members gm

    JOIN users u
      ON gm.user_id = u.id

    WHERE gm.group_id = ?
  `),

  addMember: db.prepare(`
    INSERT OR IGNORE INTO group_members
    (
      group_id,
      user_id
    )
    VALUES (?, ?)
  `),

  removeMember: db.prepare(`
    DELETE FROM group_members
    WHERE group_id = ?
    AND user_id = ?
  `),

  getUserGroups: db.prepare(`
    SELECT g.*

    FROM groups_table g

    JOIN group_members gm
      ON g.id = gm.group_id

    WHERE gm.user_id = ?
  `)
};

// ======================
// MESSAGE QUERIES
// ======================

const messageQueries = {

  insert: db.prepare(`
    INSERT INTO messages
    (
      id,
      title,
      body,
      sender_id,
      target_type,
      target_id,
      file_name,
      file_original,
      file_mime,
      file_size,
      file_url
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  findAll: db.prepare(`
    SELECT
      m.*,
      u.name as sender_name,
      u.role as sender_role

    FROM messages m

    JOIN users u
      ON m.sender_id = u.id

    ORDER BY m.created_at DESC
  `),

  findForUser: db.prepare(`
    SELECT
      m.*,
      u.name as sender_name,
      u.role as sender_role

    FROM messages m

    JOIN users u
      ON m.sender_id = u.id

    WHERE

      m.target_type = 'all'

      OR (
        m.target_type = 'user'
        AND m.target_id = ?
      )

      OR (
        m.target_type = 'group'
        AND m.target_id IN (
          SELECT group_id
          FROM group_members
          WHERE user_id = ?
        )
      )

      OR (
        m.target_type = 'admin_reply'
        AND m.sender_id = ?
      )

    ORDER BY m.created_at ASC
  `),

  findById: db.prepare(`
    SELECT *
    FROM messages
    WHERE id = ?
  `),

  delete: db.prepare(`
    DELETE FROM messages
    WHERE id = ?
  `)
};

// ======================
// RECEIPT QUERIES
// ======================

const receiptQueries = {

  upsertDelivered: db.prepare(`
    INSERT OR IGNORE INTO message_receipts
    (
      message_id,
      user_id
    )
    VALUES (?, ?)
  `),

  markRead: db.prepare(`
    UPDATE message_receipts
    SET read_at = datetime('now')
    WHERE message_id = ?
    AND user_id = ?
  `),

  isRead: db.prepare(`
    SELECT read_at
    FROM message_receipts
    WHERE message_id = ?
    AND user_id = ?
  `),

  getReadCount: db.prepare(`
    SELECT COUNT(*) as count
    FROM message_receipts
    WHERE message_id = ?
    AND read_at IS NOT NULL
  `),

  getDeliveredCount: db.prepare(`
    SELECT COUNT(*) as count
    FROM message_receipts
    WHERE message_id = ?
  `),

  deleteForMessage: db.prepare(`
    DELETE FROM message_receipts
    WHERE message_id = ?
  `)
};

// ======================
// PRIVATE CHAT QUERIES
// ======================

const privateChatQueries = {

  findOrCreate: db.prepare(`
    INSERT OR IGNORE INTO private_chats
    (
      id,
      user1_id,
      user2_id
    )
    VALUES (?, ?, ?)
  `),

  findByUsers: db.prepare(`
    SELECT *
    FROM private_chats
    WHERE
      (user1_id = ? AND user2_id = ?)
      OR
      (user1_id = ? AND user2_id = ?)
  `),

  findById: db.prepare(`
    SELECT *
    FROM private_chats
    WHERE id = ?
  `),

  findAllForUser: db.prepare(`
    SELECT
      pc.*,

      CASE
        WHEN pc.user1_id = ?
        THEN u2.name
        ELSE u1.name
      END as other_name,

      CASE
        WHEN pc.user1_id = ?
        THEN u2.id
        ELSE u1.id
      END as other_id,

      CASE
        WHEN pc.user1_id = ?
        THEN u2.email
        ELSE u1.email
      END as other_email

    FROM private_chats pc

    JOIN users u1
      ON pc.user1_id = u1.id

    JOIN users u2
      ON pc.user2_id = u2.id

    WHERE
      pc.user1_id = ?
      OR
      pc.user2_id = ?
  `),
};

// ======================
// PRIVATE MESSAGE QUERIES
// ======================

const privateMessageQueries = {

  insert: db.prepare(`
    INSERT INTO private_messages
    (
      id,
      chat_id,
      sender_id,
      body,
      file_url,
      file_name,
      file_mime,
      reply_to
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  findByChatId: db.prepare(`
    SELECT
      pm.*,
      u.name as sender_name,
      pms.read_at,
      pms.delivered_at,
      pms.deleted_for_me

    FROM private_messages pm

    JOIN users u
      ON pm.sender_id = u.id

    LEFT JOIN private_message_status pms
      ON pm.id = pms.message_id
      AND pms.user_id = ?

    WHERE
      pm.chat_id = ?
      AND pm.deleted_for_everyone = 0
      AND (
        pms.deleted_for_me IS NULL
        OR pms.deleted_for_me = 0
      )

    ORDER BY pm.created_at ASC
  `),

  findById: db.prepare(`
    SELECT *
    FROM private_messages
    WHERE id = ?
  `),

  deleteForEveryone: db.prepare(`
    UPDATE private_messages
    SET deleted_for_everyone = 1
    WHERE id = ?
  `),

  deleteForMe: db.prepare(`
    INSERT OR REPLACE INTO private_message_status
    (
      message_id,
      user_id,
      deleted_for_me
    )
    VALUES (?, ?, 1)
  `),

  markDelivered: db.prepare(`
    INSERT OR IGNORE INTO private_message_status
    (
      message_id,
      user_id
    )
    VALUES (?, ?)
  `),

  markRead: db.prepare(`
    UPDATE private_message_status
    SET read_at = datetime('now')
    WHERE message_id = ?
    AND user_id = ?
  `),

  getUnreadCount: db.prepare(`
    SELECT COUNT(*) as count

    FROM private_messages pm

    LEFT JOIN private_message_status pms
      ON pm.id = pms.message_id
      AND pms.user_id = ?

    WHERE
      pm.chat_id = ?
      AND pm.sender_id != ?
      AND (
        pms.read_at IS NULL
      )
  `),
};

// ======================
// GROUP MESSAGE QUERIES
// ======================

const groupMessageQueries = {

  insert: db.prepare(`
    INSERT INTO group_messages
    (
      id,
      group_id,
      sender_id,
      body,
      file_url,
      file_name,
      file_mime,
      reply_to
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  findByGroupId: db.prepare(`
    SELECT
      gm.*,
      u.name as sender_name,
      gms.read_at,
      gms.delivered_at,
      gms.deleted_for_me

    FROM group_messages gm

    JOIN users u
      ON gm.sender_id = u.id

    LEFT JOIN group_message_status gms
      ON gm.id = gms.message_id
      AND gms.user_id = ?

    WHERE
      gm.group_id = ?
      AND gm.deleted_for_everyone = 0
      AND (
        gms.deleted_for_me IS NULL
        OR gms.deleted_for_me = 0
      )

    ORDER BY gm.created_at ASC
  `),

  findById: db.prepare(`
    SELECT *
    FROM group_messages
    WHERE id = ?
  `),

  deleteForEveryone: db.prepare(`
    UPDATE group_messages
    SET deleted_for_everyone = 1
    WHERE id = ?
  `),

  markDelivered: db.prepare(`
    INSERT OR IGNORE INTO group_message_status
    (
      message_id,
      user_id
    )
    VALUES (?, ?)
  `),

  markRead: db.prepare(`
    UPDATE group_message_status
    SET read_at = datetime('now')
    WHERE message_id = ?
    AND user_id = ?
  `),

  getUnreadCount: db.prepare(`
    SELECT COUNT(*) as count

    FROM group_messages gm

    LEFT JOIN group_message_status gms
      ON gm.id = gms.message_id
      AND gms.user_id = ?

    WHERE
      gm.group_id = ?
      AND gm.sender_id != ?
      AND (
        gms.read_at IS NULL
      )
  `),
};

// ======================
// USER PROFILE QUERIES
// ======================

const userProfileQueries = {

  upsert: db.prepare(`
    INSERT OR REPLACE INTO user_profiles
    (
      user_id,
      avatar_url,
      about,
      last_seen,
      is_online
    )
    VALUES (?, ?, ?, ?, ?)
  `),

  findByUserId: db.prepare(`
    SELECT *
    FROM user_profiles
    WHERE user_id = ?
  `),

  updateOnline: db.prepare(`
    UPDATE user_profiles
    SET
      is_online = ?,
      last_seen = datetime('now')
    WHERE user_id = ?
  `),

  updateAvatar: db.prepare(`
    UPDATE user_profiles
    SET avatar_url = ?
    WHERE user_id = ?
  `),

  updateAbout: db.prepare(`
    UPDATE user_profiles
    SET about = ?
    WHERE user_id = ?
  `),
};

// ======================
// ANALYTICS
// ======================

const analyticsQueries = {

  totalUsers: db.prepare(`
    SELECT COUNT(*) as count
    FROM users
    WHERE role = ?
  `),

  approvedUsers: db.prepare(`
    SELECT COUNT(*) as count
    FROM users
    WHERE role = ?
    AND approved = 1
  `),

  totalMessages: db.prepare(`
    SELECT COUNT(*) as count
    FROM messages
  `),

  totalReads: db.prepare(`
    SELECT COUNT(*) as count
    FROM message_receipts
    WHERE read_at IS NOT NULL
  `),

  totalDelivered: db.prepare(`
    SELECT COUNT(*) as count
    FROM message_receipts
  `)
};

// ======================
// EXPORTS
// ======================

module.exports = {
  db,
  userQueries,
  requestQueries,
  groupQueries,
  messageQueries,
  receiptQueries,
  analyticsQueries,
  privateChatQueries,
  privateMessageQueries,
  groupMessageQueries,
  userProfileQueries,
  uuidv4
};