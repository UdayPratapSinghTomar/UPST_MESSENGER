// const jwt = require("jsonwebtoken");
// const admin = require('../config/firebase');
// const { User, ChatMember, Message, MessageStatus } = require("../models");
// const { sendMessage } = require("../services/messageService");
// const EVENTS = require("../utils/socketEvents");
// const { Events } = require("pg");

// module.exports = (io) => {

//     io.use(async (socket, next) => {
//         try {
//             const token = socket.handshake.auth?.token || socket.handshake.query?.token;

//             if (!token) {
//                 return next(new Error("Token missing"));
//             }

//             const decoded = jwt.verify(token, process.env.JWT_SECRET);
//             socket.user = decoded;

//             await User.update(
//                 { is_online: true },
//                 { where: { id: decoded.id } }
//             );

//             return next();
//         } catch (err) {
//             console.log("Socket Auth Error:", err.message);
//             return next(new Error("Authentication failed"));
//         }
//     });

//     io.on("connection", async (socket) => {
//         console.log("User connected:", socket.user.id);

//         await User.update(
//             { isOnline: true },
//             { where: { id: socket.user.id } }
//         )
//         // personal room (important later)
//         socket.join(`user_${socket.user.id}`);

//         socket.emit("connected", { message: "Socket working!" });

//         // JOIN Chat ROOM
//         socket.on(EVENTS.JOIN_CHAT, async (chat_id) =>{
//             try{ 
//                 if(!chat_id){
//                     return socket.emit("error", {
//                         message: "chat_id is required"
//                     });
//                 }

//                 // Check if user is member of Chat
//                 const isMember = await ChatMember.findOne({
//                     where: {
//                         chat_id,
//                         user_id: socket.user.id
//                     }
//                 });

//                 if(!isMember){
//                     return socket.emit("error", {
//                         message: "Your are not a member of this Chat"
//                     });
//                 }

//                 // const roomName = `Chat_${chat_id}`;
//                 socket.join(chat_id);

//                 socket.emit("joined_Chat", {
//                     chat_id,
//                     // room: roomName
//                 });
//                 console.log(`User ${socket.user.id} joined chat ${chat_id}`)
//                 // console.log(`User ${socket.user.id} joined ${roomName}`);
//             }catch(err){
//                 console.error("Join Chat error:", error);
//                 socket.emit("error", {
//                     message: "Failed to join Chat"
//                 });
//             }
//         });

//         // Typing
//         socket.on(EVENTS.TYPING, async(chat_id) => {
//             socket.to(chat_id).emit('user_typing', {
//                 user_id: socket.user.id,
//                 chat_id
//             });
//         });
//         // Stop typing
//         socket.on(EVENTS.STOP_TYPING, async(chat_id) => {
//             socket.to(chat_id).emit('user_stop_typing', {
//                 user_id: socket.user.id,
//                 chat_id
//             });
//         });
    
//         // send message
//         socket.on(EVENTS.SEND_MESSAGE, async (data) => {
//             try{
//                 const {
//                     chat_id,
//                     content,
//                     message_type = 'text',
//                     file_url = null,
//                     replied_to_message_id = null
//                 } = data

//                 if(!chat_id || !content){
//                     return socket.emit(EVENTS.ERROR, {
//                         message: "chat_id and content required",
//                     });
//                 }

//                 const members = await ChatMember.findAll({
//                     where: { chat_id }
//                 })

//                 if(!members){
//                     return socket.emit("error", {
//                         message: "Your are not a member of this Chat"
//                     });
//                 }

//                 const message = await Message.create({
//                     chat_id,
//                     sender_id: socket.user.id,
//                     message_type,
//                     content,
//                     file_url,
//                     replied_to_message_id
//                 });
                
//                 // create status for each member
//                 const statusData = members.map(m => ({
//                     message_id: message.id,
//                     user_id: m.user_id,
//                     status: m.user_id === socket.user.id ? 'read' : 'sent'
//                 }));

//                 await MessageStatus.bulkCreate(statusData);

//                 // Emit message to Chat room
//                 io.to(`chat_${chat_id}`).emit(
//                     EVENTS.NEW_MESSAGE,
//                     message
//                 );
//             }catch(err){
//                 socket.emit(EVENTS.ERROR, {
//                     message: err.message,
//                 });
//             }
//         });

//         // DELIVER MESSAGE
//         socket.on(EVENTS.MESSAGE_DELIVERED, async ({message_id}) => {
//             await MessageStatus.update(
//                 { status: 'delivered'},
//                 {
//                     where: { 
//                         message_id, 
//                         user_id: socket.user.id, 
//                         status: 'sent'
//                     }
//                 },
//             )
//         });

//         // READ MESSAGE
//         socket.on(EVENTS.MESSAGE_READ, async ({chat_id}) => {
//             await MessageStatus.update(
//                 { status: 'read' },
//                 {
//                     where: {
//                         user_id: socket.user.id
//                     },
//                     include: [{
//                         model: Message,
//                         where: { chatId }
//                     }]
//                 }
//             )
//         });

//         // MESSAGE READ UPDATE
//         socket.to(chat_id).emit('message_read_update', {
//             user_id: socket.user.id,
//             chat_id
//         });

//         // Leave Chat
//         socket.on(EVENTS.LEAVE_CHAT, async (data) => {
//             const { chat_id } = data;
//             if(!chat_id) return;

//             const roomName = `Chat_${chat_id}`;
//             socket.leave(roomName);

//             socket.emit("left_Chat", {
//                 chat_id
//             });
//         });

//         // disconnect from socket
//         socket.on(EVENTS.DISCONNECTED, async () => {
//             await User.update(
//                 { is_online: false, last_seen: new Date() },
//                 { where: { id: socket.user.id } }
//             );
//             console.log("User disconnected:", socket.user.id);
//         });
//     });
// };

const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const admin = require("../config/firebase");
const { User, ChatMember, Message, MessageStatus } = require("../models");
const EVENTS = require("../utils/socketEvents");

module.exports = (io) => {

  // 🔐 SOCKET AUTH MIDDLEWARE
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token) return next(new Error("Token missing"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;

      await User.update(
        { is_online: true },
        { where: { id: decoded.id } }
      );

      next();
    } catch (err) {
      console.error("Socket auth error:", err.message);
      next(new Error("Authentication failed"));
    }
  });

  // 🔌 SOCKET CONNECTION
  io.on("connection", async (socket) => {
    console.log("User connected:", socket.user.id);

    // Personal room (for notifications later)
    socket.join(`user_${socket.user.id}`);

    socket.emit("connected", { message: "Socket connected" });

    // 🧩 JOIN CHAT ROOM
    socket.on(EVENTS.JOIN_CHAT, async (chat_id) => {
      try {
        if (!chat_id) {
          return socket.emit(EVENTS.ERROR, {
            message: "chat_id is required",
          });
        }

        const isMember = await ChatMember.findOne({
          where: {
            chat_id,
            user_id: socket.user.id,
          },
        });

        if (!isMember) {
          return socket.emit(EVENTS.ERROR, {
            message: "You are not a member of this chat",
          });
        }

        socket.join(`chat_${chat_id}`);

        socket.emit("joined_chat", { chat_id });
        console.log(
          `User ${socket.user.id} joined chat_${chat_id}`
        );
      } catch (err) {
        socket.emit(EVENTS.ERROR, {
          message: "Failed to join chat",
        });
      }
    });

    // ✍️ TYPING
    socket.on(EVENTS.TYPING, (chat_id) => {
      socket.to(`chat_${chat_id}`).emit(EVENTS.TYPING, {
        user_id: socket.user.id,
        chat_id,
      });
    });

    socket.on(EVENTS.STOP_TYPING, (chat_id) => {
      socket.to(`chat_${chat_id}`).emit(EVENTS.STOP_TYPING, {
        user_id: socket.user.id,
        chat_id,
      });
    });

    // 📩 SEND MESSAGE (TEXT / MEDIA)
    socket.on(EVENTS.SEND_MESSAGE, async (data) => {
      try {
        const {
          chat_id,
          content = null,
          message_type = "text",
          file_url = null,
          replied_to_message_id = null,
        } = data;

        if (!chat_id) {
          return socket.emit(EVENTS.ERROR, {
            message: "chat_id is required",
          });
        }

        const members = await ChatMember.findAll({
          where: { chat_id },
        });

        if (!members || members.length === 0) {
          return socket.emit(EVENTS.ERROR, {
            message: "You are not a member of this chat",
          });
        }

        const message = await Message.create({
          chat_id,
          sender_id: socket.user.id,
          message_type,
          content,
          file_url,
          replied_to_message_id,
        });

        // 📌 CREATE MESSAGE STATUS
        const statusData = members.map((m) => ({
          message_id: message.id,
          user_id: m.user_id,
          status:
            m.user_id === socket.user.id ? "read" : "sent",
        }));

        await MessageStatus.bulkCreate(statusData);

        // 🔔 PUSH NOTIFICATION (PHASE 9)
        for (const m of members) {
          if (m.user_id !== socket.user.id) {
            const user = await User.findByPk(m.user_id);
            if (user?.fcmToken) {
              await admin.messaging().send({
                token: user.fcmToken,
                notification: {
                  title: "New Message",
                  body: content || "Media message",
                },
                data: {
                  chat_id: String(chat_id),
                },
              });
            }
          }
        }

        // 📢 EMIT MESSAGE
        io.to(`chat_${chat_id}`).emit(
          EVENTS.NEW_MESSAGE,
          message
        );
      } catch (err) {
        console.error(err);
        socket.emit(EVENTS.ERROR, {
          message: err.message || "Message send failed",
        });
      }
    });

    // ✅ MESSAGE DELIVERED
    socket.on(EVENTS.MESSAGE_DELIVERED, async ({ message_id }) => {
      await MessageStatus.update(
        { status: "delivered" },
        {
          where: {
            message_id,
            user_id: socket.user.id,
            status: "sent",
          },
        }
      );
    });

    // 👁️ MESSAGE READ
    socket.on(EVENTS.MESSAGE_READ, async ({ chat_id }) => {
      await MessageStatus.update(
        { status: "read" },
        {
          where: {
            user_id: socket.user.id,
            status: { [Op.ne]: "read" },
          },
        }
      );

      socket.to(`chat_${chat_id}`).emit(
        EVENTS.MESSAGE_READ_UPDATE,
        {
          user_id: socket.user.id,
          chat_id,
        }
      );
    });

    // 🚪 LEAVE CHAT
    socket.on(EVENTS.LEAVE_CHAT, ({ chat_id }) => {
      if (!chat_id) return;
      socket.leave(`chat_${chat_id}`);
      socket.emit("left_chat", { chat_id });
    });

    // 🔌 DISCONNECT
    socket.on(EVENTS.DISCONNECTED, async () => {
      await User.update(
        {
          is_online: false,
          last_seen: new Date(),
        },
        { where: { id: socket.user.id } }
      );
      console.log("User disconnected:", socket.user.id);
    });
  });
};
