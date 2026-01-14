require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');

const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);

const chatSocket = require('./src/sockets/chatSocket');
const db = require('./src/models');
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function syncDatabase() {
  try {
    await db.sequelize.sync({ alter: true })

    console.log('Database synced successfully\n');

    console.log('Synced Tables:')
    Object.keys(db)
      .filter(model => model !== 'sequelize')
      .forEach(model => {
        console.log(` - ${db[model].getTableName()}`);
      })

  } catch (error) {
    console.error('Sync error:', error);
  }
}

syncDatabase();

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    upgradeTimeout: 30000,
});

// make io accessible in controllers
app.set('io', io);
chatSocket(io);

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const activeUsersRoutes = require('./src/routes/activeUsersRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const mediaRoutes = require('./src/routes/mediaRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const searchRoutes = require('./src/routes/searchRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const prioritiesRoutes = require('./src/routes/prioritiesRoutes');
const assigneeRoutes = require('./src/routes/assigneeRoutes');

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/chat', chatRoutes);
app.use('/active-users', activeUsersRoutes);
app.use('/message', messageRoutes);
app.use('/media', mediaRoutes);
app.use('/notification', notificationRoutes);
app.use('/search', searchRoutes);
app.use('/project', projectRoutes);
app.use('/priorities', prioritiesRoutes);
app.use('/assignee', assigneeRoutes);

app.use('/uploads', express.static(path.join(__dirname,  'uploads')));
app.use(express.static(path.join(__dirname, 'src', 'public')));

server.listen(PORT, () => {
    console.log('Server running on port', PORT);
});