require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

// ======================
// MIDDLEWARE
// ======================

app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);

app.use(
  '/uploads',
  express.static(
    path.join(
      __dirname,
      'public/uploads'
    )
  )
);

// ======================
// UPLOADS
// ======================

const uploadDir =
  './public/uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true
  });
}

// ======================
// EMAIL
// ======================

const transporter =
  nodemailer.createTransport({
    service: 'gmail',

    auth: {
      user:
        process.env.EMAIL_USER,

      pass:
        process.env.EMAIL_PASS
    }
  });

transporter.verify(
  (err) => {
    if (err) {
      console.log(
        '❌ EMAIL ERROR:',
        err.message
      );
    } else {
      console.log(
        '✅ Gmail SMTP Ready'
      );
    }
  }
);

app.set(
  'transporter',
  transporter
);

// ======================
// SOCKETS
// ======================

const connectedMembers =
  new Map();

app.set(
  'connectedMembers',
  connectedMembers
);

app.set('io', io);

io.on('connection', (socket) => {

  socket.on('join', ({ userId, role }) => {

    socket.userId = userId;
    socket.role = role;

    socket.join(`user:${userId}`);

    if (
      role === 'member' ||
      role === 'admin'
    ) {

      connectedMembers.set(
        userId,
        socket.id
      );

      io.emit(
        'online_count',
        {
          count:
            connectedMembers.size
        }
      );

      io.emit(
        'user_online',
        {
          userId,
          online: true
        }
      );

      // ======================
      // PROFILE ONLINE UPDATE
      // ======================

      try {

        const {
          userProfileQueries
        } = require('./models/Db');

        const existing =
          userProfileQueries
            .findByUserId
            .get(userId);

        if (!existing) {

          userProfileQueries
            .upsert
            .run(
              userId,
              null,
              'Hey there! I am using Broadcast.',
              null,
              1
            );

        } else {

          userProfileQueries
            .updateOnline
            .run(
              1,
              userId
            );
        }

      } catch (e) {
        console.log(
          'PROFILE UPDATE ERROR:',
          e.message
        );
      }
    }
  });

  // ======================
  // TYPING
  // ======================

  socket.on(
    'typing',
    ({
      chatId,
      chatType,
      toUserId
    }) => {

      if (
        chatType === 'private'
      ) {

        io.to(
          `user:${toUserId}`
        ).emit(
          'typing',
          {
            chatId,
            userId:
              socket.userId
          }
        );

      } else {

        socket.to(
          `group:${chatId}`
        ).emit(
          'typing',
          {
            chatId,
            userId:
              socket.userId
          }
        );
      }
    }
  );

  socket.on(
    'stop_typing',
    ({
      chatId,
      chatType,
      toUserId
    }) => {

      if (
        chatType === 'private'
      ) {

        io.to(
          `user:${toUserId}`
        ).emit(
          'stop_typing',
          {
            chatId,
            userId:
              socket.userId
          }
        );

      } else {

        socket.to(
          `group:${chatId}`
        ).emit(
          'stop_typing',
          {
            chatId,
            userId:
              socket.userId
          }
        );
      }
    }
  );

  // ======================
  // GROUP JOIN
  // ======================

  socket.on(
    'join_group',
    ({ groupId }) => {

      socket.join(
        `group:${groupId}`
      );
    }
  );

  // ======================
  // DISCONNECT
  // ======================

  socket.on(
    'disconnect',
    () => {

      if (socket.userId) {

        connectedMembers.delete(
          socket.userId
        );

        io.emit(
          'online_count',
          {
            count:
              connectedMembers.size
          }
        );

        io.emit(
          'user_online',
          {
            userId:
              socket.userId,
            online: false
          }
        );

        try {

          const {
            userProfileQueries
          } = require('./models/Db');

          userProfileQueries
            .updateOnline
            .run(
              0,
              socket.userId
            );

        } catch (e) {
          console.log(
            'OFFLINE UPDATE ERROR:',
            e.message
          );
        }
      }
    }
  );
});
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Broadcast Backend Running'
  });
});
// ======================
// ROUTES
// ======================
// DEBUG — DB లో chats చూడటానికి

app.use(
  '/api/auth',
  require('./routes/auth')
);

app.use(
  '/api/forgot',
  require('./routes/forgot')
);

app.use(
  '/api/admin',
  require('./routes/admin')
);

app.use(
  '/api/member',
  require('./routes/member')
);

// ======================
// CHAT ROUTE
// ======================

app.use(
  '/api/chat',
  require('./routes/chat')
);

// ======================
// START
// ======================

const PORT =
  process.env.PORT || 3000;

server.listen(PORT, () => {

  console.log(
    `🚀 Server running on ${PORT}`
  );
});