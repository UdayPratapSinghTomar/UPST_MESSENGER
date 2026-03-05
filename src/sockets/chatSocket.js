const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { User, ChatMember, MessageStatus } = require("../models");
const EVENTS = require("../utils/socketEvents");

module.exports = (io) => {
  // SOCKET AUTH MIDDLEWARE
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("Token missing"));

      socket.user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  // SOCKET CONNECTION
  io.on(EVENTS.CONNECTION, async (socket) => {
    const userId = socket.user.id;
    console.log("User connected:", userId);

    await User.update(
      { is_online: true, last_seen: null },
      { where: { id: userId } },
    );

    // Personal room for notifications
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room user_${userId}`);

    socket.emit(EVENTS.CONNECTED, { message: "Socket connected" });

    // JOIN CHAT ROOM
    socket.on(EVENTS.JOIN_CHAT, async (chat_id) => {
      try {
        if (!chat_id){
          return socket.emit(EVENTS.SOCKET_ERROR, { message: "chat_id is required" });
        }

        const isMember = await ChatMember.findOne({
          where: { chat_id, user_id: userId },
        });

        if (!isMember){
          return socket.emit(EVENTS.SOCKET_ERROR, { message: "Not a member of this chat" });
        }

        socket.join(`chat_${chat_id}`);
        socket.emit(EVENTS.JOINED_CHAT, { chat_id });
        
        console.log(`User ${userId} joined chat_${chat_id}`);

      } catch (err) {
        socket.emit(EVENTS.SOCKET_ERROR, {
          message: err.message,
        });
      }
    });

    // =========================
    // MESSAGE READ
    // =========================
    socket.on(EVENTS.MESSAGE_READ, async ({ chat_id }) => {
      try {

        await MessageStatus.update(
          { status: "read", read_at: new Date() },
          {
            where: {
              chat_id,
              user_id: userId,
              status: { [Op.ne]: "read" }
            }
          }
        );

        socket.to(`chat_${chat_id}`).emit(
          EVENTS.MESSAGE_READ_UPDATE,
          { chat_id, user_id: userId }
        );

      } catch (err) {
        socket.emit(EVENTS.SOCKET_ERROR, { message: err.message });
      }
    });

    // =========================
    // TYPING START
    // =========================
    socket.on(EVENTS.USER_TYPING, ({ chat_id }) => {
      socket.to(`chat_${chat_id}`).emit(EVENTS.USER_TYPING, {
        chat_id,
        user_id: userId
      });
    });

    // =========================
    // TYPING STOP
    // =========================
    socket.on(EVENTS.USER_STOP_TYPING, ({ chat_id }) => {
      socket.to(`chat_${chat_id}`).emit(EVENTS.USER_STOP_TYPING, {
        chat_id,
        user_id: userId
      });
    });

    // =========================
    // LEAVE CHAT
    // =========================
    socket.on(EVENTS.LEAVE_CHAT, ({ chat_id }) => {
      socket.leave(`chat_${chat_id}`);
      socket.emit(EVENTS.LEFT_CHAT, { chat_id });
    });

    // =========================
    // DISCONNECT
    // =========================
    socket.on("disconnect", async () => {

      await User.update(
        { is_online: false, last_seen: new Date() },
        { where: { id: userId } }
      );

      console.log("User disconnected:", userId);
    });
  });  
};
