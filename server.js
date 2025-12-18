require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const path = require('path');

const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);

const chatSocket = require("./src/sockets/chatSocket");
const db = require("./src/models");
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
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingInterval: 60000,   // 60 seconds
    pingTimeout: 60000     // 60 seconds
});

// make io accessible in controllers
app.set("io", io);
chatSocket(io);

const authRoutes = require("./src/routes/authRoutes");
const chatRoutes = require("./src/routes/chatRoutes");
const chatListRoutes = require("./src/routes/chatListRoutes");
const activeUsersRoutes = require("./src/routes/activeUsersRoutes");
const messageRoutes = require("./src/routes/messageRoutes");
const mediaRoutes = require("./src/routes/mediaRoutes");
const notificationRoutes = require('./src/routes/notificationRoutes');

app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);
app.use("/chatlist", chatListRoutes);
app.use("/active-users", activeUsersRoutes);
app.use("/message", messageRoutes);
app.use("/media", mediaRoutes);
app.use("/notification", notificationRoutes);

app.use('/uploads', express.static(path.join(__dirname,  'uploads')));

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});