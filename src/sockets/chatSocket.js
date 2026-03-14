const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { User, ChatMember, MessageStatus, SharedFile } = require("../models");
const EVENTS = require("../utils/socketEvents");
const { getActiveUsers } = require("../utils/activeUsers");

module.exports = (io) => {

  /**
   * SOCKET AUTH
   */
  io.use((socket, next) => {
    try {

      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      const orgId =
      socket.handshake.auth?.organization_id ||
      socket.handshake.query?.organization_id;

      // console.log("organization di", orgId);
      if (!token) return next(new Error("Token missing"));

      const payload = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET
      );
      // console.log(payload)
      socket.user = payload;
      socket.org_id = orgId;
      next();

    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });


  /**
   * SOCKET CONNECTION
   */
  io.on(EVENTS.CONNECTION, async (socket) => {

    const userId = socket.user.id;
    const orgId = socket.org_id;

    console.log("User connected:", userId);

    /**
     * Mark user online
     */
    await User.update(
      { is_online: true, last_seen: null },
      { where: { id: userId } }
    );

    /**
     * Personal notification room
     */
    socket.join(`user_${userId}`);

    /**
     * Organization presence room
     */
    socket.join(`org_${orgId}`);

    socket.emit(EVENTS.CONNECTED, {
      message: "Socket connected"
    });

    /**
     * Fetch profile image
     */
    // const profile = await SharedFile.findOne({
    //   where: {
    //     user_id: userId,
    //     file_type: "image"
    //   },
    //   attributes: ["file_url"]
    // });
    const activeUsers = await getActiveUsers(userId,orgId);
    // console.log("active users listing - ",activeUsers);
    /**
     * Broadcast user online
     */
    socket.to(`org_${orgId}`).emit(EVENTS.ACTIVE_USERS_LIST, activeUsers);


    /**
     * JOIN CHAT
     */
    socket.on(EVENTS.JOIN_CHAT, async (chat_id) => {

      try {

        if (!chat_id) {
          return socket.emit(EVENTS.SOCKET_ERROR, {
            message: "chat_id is required"
          });
        }

        const isMember = await ChatMember.findOne({
          where: { chat_id, user_id: userId }
        });

        if (!isMember) {
          return socket.emit(EVENTS.SOCKET_ERROR, {
            message: "Not a member of this chat"
          });
        }

        socket.join(`chat_${chat_id}`);

        socket.emit(EVENTS.JOINED_CHAT, { chat_id });

      } catch (err) {

        socket.emit(EVENTS.SOCKET_ERROR, {
          message: err.message
        });

      }
    });


    /**
     * MESSAGE READ
     */
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

        socket.emit(EVENTS.SOCKET_ERROR, {
          message: err.message
        });

      }
    });


    /**
     * TYPING START
     */
    socket.on(EVENTS.USER_TYPING, ({ chat_id }) => {

      socket.to(`chat_${chat_id}`).emit(
        EVENTS.USER_TYPING,
        {
          chat_id,
          user_id: userId
        }
      );

    });


    /**
     * TYPING STOP
     */
    socket.on(EVENTS.USER_STOP_TYPING, ({ chat_id }) => {

      socket.to(`chat_${chat_id}`).emit(
        EVENTS.USER_STOP_TYPING,
        {
          chat_id,
          user_id: userId
        }
      );

    });


    /**
     * LEAVE CHAT
     */
    socket.on(EVENTS.LEAVE_CHAT, ({ chat_id }) => {

      socket.leave(`chat_${chat_id}`);

      socket.emit(EVENTS.LEFT_CHAT, { chat_id });

    });


    /**
     * DISCONNECT
     */
    socket.on(EVENTS.DISCONNECT, async () => {

      await User.update(
        {
          is_online: false,
          last_seen: new Date()
        },
        { where: { id: userId } }
      );

      const activeUsers = await getActiveUsers(orgId);

      io.to(`org_${orgId}`).emit(
        EVENTS.ACTIVE_USERS_LIST,
        activeUsers
      );

      console.log("User disconnected:", userId);

    });

  });

};