const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  db,
  userQueries,
  requestQueries,
  groupQueries,
  messageQueries,
  receiptQueries,
  uuidv4
} = require('../models/Db');

const {
  authMiddleware,
  adminOnly
} = require('../middleware/auth');

// ======================
// UPLOADS
// ======================

if (!fs.existsSync('./public/uploads')) {

  fs.mkdirSync('./public/uploads', {
    recursive: true
  });
}

const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    cb(null, './public/uploads/');
  },

  filename: (req, file, cb) => {

    cb(
      null,
      uuidv4() + path.extname(file.originalname)
    );
  }
});

const upload = multer({

  storage,

  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

// ======================
// ANALYTICS
// ======================

router.get(
  '/analytics',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const connected =
        req.app.get('connectedMembers');

      const totalMembers =
        db.prepare(`
          SELECT COUNT(*) as count
          FROM users
          WHERE role = 'member'
        `).get().count;

      const approvedMembers =
        db.prepare(`
          SELECT COUNT(*) as count
          FROM users
          WHERE role = 'member'
          AND approved = 1
        `).get().count;

      const totalMessages =
        db.prepare(`
          SELECT COUNT(*) as count
          FROM messages
        `).get().count;

      const totalReads =
        db.prepare(`
          SELECT COUNT(*) as count
          FROM message_receipts
          WHERE read_at IS NOT NULL
        `).get().count;

      const totalDelivered =
        db.prepare(`
          SELECT COUNT(*) as count
          FROM message_receipts
        `).get().count;

      const unreadCount =
        totalDelivered - totalReads;

      const readRate =
        totalDelivered > 0
          ? Math.round(
              (
                totalReads /
                totalDelivered
              ) * 100
            )
          : 0;

      res.json({
        totalMembers,
        approvedMembers,
        onlineMembers:
          connected?.size || 0,
        totalMessages,
        totalReads,
        totalDelivered,
        unreadCount,
        readRate
      });

    } catch (err) {

      console.log(
        'ANALYTICS ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to fetch analytics'
      });
    }
  }
);

// ======================
// MEMBERS
// ======================

router.get(
  '/members',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const connected =
        req.app.get('connectedMembers');

      const members =
        userQueries.findApproved
          .all('member')
          .map((m) => ({
            ...m,
            online:
              connected.has(m.id)
          }));

      res.json(members);

    } catch (err) {

      console.log(
        'MEMBERS ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to fetch members'
      });
    }
  }
);

// ======================
// JOIN REQUESTS
// ======================

router.get(
  '/join-requests',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      res.json(
        requestQueries.findAll.all()
      );

    } catch (err) {

      console.log(
        'REQUEST ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to fetch requests'
      });
    }
  }
);

router.post(
  '/join-requests/:id/approve',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const allReqs =
        requestQueries.findAll.all();

      const found =
        allReqs.find(
          r => r.id === req.params.id
        );

      if (!found) {

        return res.status(404).json({
          error:
            'Request not found'
        });
      }

      requestQueries.updateStatus.run(
        'approved',
        req.params.id
      );

      userQueries.approve.run(
        found.user_id
      );

      const io =
        req.app.get('io');

      io.emit(
        'request_decision',
        {
          userId:
            found.user_id,
          status:
            'approved'
        }
      );

      res.json({
        success: true
      });

    } catch (err) {

      console.log(
        'APPROVE ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to approve request'
      });
    }
  }
);

router.post(
  '/join-requests/:id/reject',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const allReqs =
        requestQueries.findAll.all();

      const found =
        allReqs.find(
          r => r.id === req.params.id
        );

      if (!found) {

        return res.status(404).json({
          error:
            'Request not found'
        });
      }

      requestQueries.updateStatus.run(
        'rejected',
        req.params.id
      );

      const io =
        req.app.get('io');

      io.emit(
        'request_decision',
        {
          userId:
            found.user_id,
          status:
            'rejected'
        }
      );

      res.json({
        success: true
      });

    } catch (err) {

      console.log(
        'REJECT ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to reject request'
      });
    }
  }
);

// ======================
// GROUPS
// ======================

router.get(
  '/groups',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const groups =
        groupQueries.findAll.all()
          .map((g) => ({
            ...g,
            members:
              groupQueries.getMembers.all(
                g.id
              )
          }));

      res.json(groups);

    } catch (err) {

      console.log(
        'GROUP ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to fetch groups'
      });
    }
  }
);

router.post(
  '/groups',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const {
        name,
        description,
        memberIds
      } = req.body;

      if (!name) {

        return res.status(400).json({
          error:
            'Group name required'
        });
      }

      const id = uuidv4();

      groupQueries.insert.run(
        id,
        name,
        description || '',
        req.user.id
      );

      if (Array.isArray(memberIds)) {

        memberIds.forEach((uid) => {

          groupQueries.addMember.run(
            id,
            uid
          );
        });
      }

      res.json({
        success: true,
        id
      });

    } catch (err) {

      console.log(
        'GROUP CREATE ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to create group'
      });
    }
  }
);

// ======================
// ADD MEMBER TO GROUP
// ======================

router.post(
  '/groups/:groupId/members',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const { groupId } =
        req.params;

      const { userId } =
        req.body;

      if (!userId) {

        return res.status(400).json({
          error: 'User ID required'
        });
      }

      const exists =
        db.prepare(`
          SELECT *
          FROM group_members
          WHERE group_id = ?
          AND user_id = ?
        `).get(
          groupId,
          userId
        );

      if (exists) {

        return res.json({
          success: true
        });
      }

      groupQueries.addMember.run(
        groupId,
        userId
      );

      res.json({
        success: true
      });

    } catch (err) {

      console.log(
        'ADD MEMBER ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to add member'
      });
    }
  }
);

// ======================
// REMOVE MEMBER FROM GROUP
// ======================

router.delete(
  '/groups/:groupId/members/:userId',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const {
        groupId,
        userId
      } = req.params;

      groupQueries.removeMember.run(
        groupId,
        userId
      );

      res.json({
        success: true
      });

    } catch (err) {

      console.log(
        'REMOVE MEMBER ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to remove member'
      });
    }
  }
);

// ======================
// DELETE GROUP
// ======================

router.delete(
  '/groups/:groupId',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const { groupId } =
        req.params;

      db.prepare(`
        DELETE FROM group_members
        WHERE group_id = ?
      `).run(groupId);

      db.prepare(`
        DELETE FROM group_messages
        WHERE group_id = ?
      `).run(groupId);

      db.prepare(`
        DELETE FROM groups_table
        WHERE id = ?
      `).run(groupId);

      res.json({
        success: true
      });

    } catch (err) {

      console.log(
        'DELETE GROUP ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to delete group'
      });
    }
  }
);

// ======================
// SEND MESSAGE
// ======================

router.post(
  '/messages',
  authMiddleware,
  adminOnly,
  upload.single('file'),
  async (req, res) => {

    try {

      const {
        title,
        body,
        targetType,
        targetId
      } = req.body;

      if (!title) {

        return res.status(400).json({
          error:
            'Title required'
        });
      }

      const io =
        req.app.get('io');

      const connected =
        req.app.get(
          'connectedMembers'
        );

      const transporter =
        req.app.get(
          'transporter'
        );

      const msgId =
        uuidv4();

      const fileName =
        req.file
          ? req.file.filename
          : null;

      const fileOriginal =
        req.file
          ? req.file.originalname
          : null;

      const fileMime =
        req.file
          ? req.file.mimetype
          : null;

      const fileSize =
        req.file
          ? req.file.size
          : null;

      const fileUrl =
        req.file
          ? '/uploads/' +
            req.file.filename
          : null;

      messageQueries.insert.run(
        msgId,
        title,
        body || '',
        req.user.id,
        targetType || 'all',
        targetId || null,
        fileName,
        fileOriginal,
        fileMime,
        fileSize,
        fileUrl
      );

      const msg =
        messageQueries.findById.get(
          msgId
        );

      // SEND TO ALL

      if (
        !targetType ||
        targetType === 'all'
      ) {

        const members =
          userQueries.findApproved.all(
            'member'
          );

        members.forEach((m) => {

          receiptQueries.upsertDelivered.run(
            msgId,
            m.id
          );

          const sid =
            connected.get(m.id);

          if (sid) {

            io.to(sid).emit(
              'new_message',
              msg
            );
          }
        });
      }

      // SEND TO USER

      else if (
        targetType === 'user'
      ) {

        receiptQueries.upsertDelivered.run(
          msgId,
          targetId
        );

        const sid =
          connected.get(targetId);

        if (sid) {

          io.to(sid).emit(
            'new_message',
            msg
          );
        }
      }

      // SEND TO GROUP

      else if (
        targetType === 'group'
      ) {

        const members =
          groupQueries.getMembers.all(
            targetId
          );

        members.forEach((m) => {

          receiptQueries.upsertDelivered.run(
            msgId,
            m.id
          );

          const sid =
            connected.get(m.id);

          if (sid) {

            io.to(sid).emit(
              'new_message',
              msg
            );
          }
        });
      }

      // EMAILS

      const approvedMembers =
        userQueries.findApproved.all(
          'member'
        );

      for (const member of approvedMembers) {

        try {

          if (transporter) {

            await transporter.sendMail({

              from:
                process.env.EMAIL_USER,

              to:
                member.email,

              subject:
                `📢 ${title}`,

              html: `
                <div style="font-family:Arial;padding:20px;">
                  <h2>${title}</h2>
                  <p>${body || ''}</p>

                  ${
                    req.file
                      ? `
                        <p>
                          📎 ${req.file.originalname}
                        </p>
                      `
                      : ''
                  }

                </div>
              `
            });
          }

        } catch (err) {

          console.log(
            'EMAIL ERROR:',
            err.message
          );
        }
      }

      io.emit(
        'message_sent',
        msg
      );

      res.json({
        success: true,
        message: msg
      });

    } catch (err) {

      console.log(
        'MESSAGE ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to send message'
      });
    }
  }
);

// ======================
// GET SENT MESSAGES
// ======================

router.get(
  '/messages',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const messages =
        db.prepare(`
          SELECT
            m.*,

            (
              SELECT COUNT(*)
              FROM message_receipts r
              WHERE r.message_id = m.id
            ) as deliveredCount,

            (
              SELECT COUNT(*)
              FROM message_receipts r
              WHERE
                r.message_id = m.id
                AND r.read_at IS NOT NULL
            ) as readCount

          FROM messages m

          ORDER BY m.created_at DESC
        `).all();

      res.json(messages);

    } catch (err) {

      console.log(
        'GET MESSAGES ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to fetch messages'
      });
    }
  }
);

// ======================
// GET MESSAGE RECEIPTS
// ======================

router.get(
  '/messages/:id/receipts',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const { id } =
        req.params;

      const receipts =
        db.prepare(`
          SELECT
            r.message_id,
            r.user_id,
            r.delivered_at,
            r.read_at,

            u.name,
            u.email,
            u.role

          FROM message_receipts r

          JOIN users u
            ON u.id = r.user_id

          WHERE r.message_id = ?

          ORDER BY
            r.read_at DESC,
            r.delivered_at DESC
        `).all(id);

      res.json(receipts);

    } catch (err) {

      console.log(
        'RECEIPTS ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to fetch receipts'
      });
    }
  }
);

// ======================
// DELETE MESSAGE
// ======================

router.delete(
  '/messages/:id',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const { id } =
        req.params;

      const existing =
        db.prepare(`
          SELECT id
          FROM messages
          WHERE id = ?
        `).get(id);

      if (!existing) {

        return res.status(404).json({
          error:
            'Message not found'
        });
      }

      db.prepare(`
        DELETE FROM message_receipts
        WHERE message_id = ?
      `).run(id);

      db.prepare(`
        DELETE FROM messages
        WHERE id = ?
      `).run(id);

      res.json({
        success: true,
        message:
          'Message deleted successfully'
      });

    } catch (err) {

      console.log(
        'DELETE MESSAGE ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to delete message'
      });
    }
  }
);

// ======================
// GET ALL MEMBER DMS
// ======================

router.get(
  '/dms',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const dms =
        db.prepare(`
          SELECT
            m.*,
            u.name as sender_name,
            u.email as sender_email

          FROM messages m

          JOIN users u
            ON m.sender_id = u.id

          WHERE
            m.target_type = 'admin_reply'

          ORDER BY m.created_at DESC
        `).all();

      res.json(dms);

    } catch (err) {

      console.log(
        'DM ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to fetch DMs'
      });
    }
  }
);

// ======================
// GET MEMBER CONVERSATION
// ======================

router.get(
  '/dms/:memberId',
  authMiddleware,
  adminOnly,
  (req, res) => {

    try {

      const {
        memberId
      } = req.params;

      const messages =
        db.prepare(`
          SELECT
            m.*,
            u.name as sender_name,
            u.role as sender_role

          FROM messages m

          JOIN users u
            ON m.sender_id = u.id

          WHERE

            (
              m.target_type = 'user'
              AND m.target_id = ?
            )

            OR

            (
              m.sender_id = ?
              AND m.target_type = 'admin_reply'
            )

          ORDER BY m.created_at ASC
        `).all(
          memberId,
          memberId
        );

      res.json(messages);

    } catch (err) {

      console.log(
        'CONVERSATION ERROR:',
        err.message
      );

      res.status(500).json({
        error:
          'Failed to fetch conversation'
      });
    }
  }
);

module.exports = router;