require("dotenv").config();
const http = require("http");
const app = require("./app");
const { Server } = require("socket.io");
const chatSocket = require("./sockets/chatSocket");

const server = http.createServer(app);

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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});