require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// MIDDLEWARE

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

// UPLOADS

const uploadDir =
  path.join(
    __dirname,
    'public/uploads'
  );

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true
  });
}

// ======================
// EMAIL
// ======================

);

// SOCKET

const connectedMembers =
  new Map();

app.set(
  'connectedMembers',
  connectedMembers
);

app.set(
  'io',
  io
);

function setUserOnline(
  userId,
  online
) {

  try {

    const {
      userProfileQueries
    } =
      require(
        './models/Db'
      );

    const user =
      userProfileQueries
      .findByUserId
      .get(userId);

    if (!user) {

      userProfileQueries
      .upsert
      .run(
        userId,
        null,
        'Hey there! I am using Broadcast.',
        null,
        online ? 1 : 0
      );

    } else {

      userProfileQueries
      .updateOnline
      .run(
        online ? 1 : 0,
        userId
      );
    }

  } catch (e) {

    console.log(
      e.message
    );
  }
}

io.on(
  'connection',
  (socket) => {

    socket.on(
      'join',
      ({
        userId,
        role
      }) => {

        socket.userId =
          userId;

        socket.role =
          role;

        socket.join(
          `user:${userId}`
        );

        connectedMembers.set(
          userId,
          socket.id
        );

        setUserOnline(
          userId,
          true
        );
      }
    );

    socket.on(
      'join_group',
      ({
        groupId
      }) => {

        socket.join(
          `group:${groupId}`
        );
      }
    );

    socket.on(
      'disconnect',
      () => {

        if (
          socket.userId
        ) {

          connectedMembers.delete(
            socket.userId
          );

          setUserOnline(
            socket.userId,
            false
          );
        }
      }
    );
  }
);

// HEALTH

app.get(
  '/',
  (
    req,
    res
  ) => {

    res.json({
      success: true,
      message:
        'Broadcast Backend Running'
    });
  }
);

// TEST MAIL

app.get(
  '/test-mail',
  async (
    req,
    res
  ) => {

    try {

      const info =
        .sendMail({

          from:
            process.env.EMAIL_USER,

          to:
            process.env.EMAIL_USER,

          subject:
            'Broadcast SMTP Test',
);

app.use(
  '/api/member',
  require('./routes/member')
);

app.use(
  '/api/chat',
  require('./routes/chat')
);

// START

const PORT =
  process.env.PORT ||
  3000;

server.listen(
  PORT,
  () => {

    console.log(
      `🚀 Server running on ${PORT}`
    );
  }
);