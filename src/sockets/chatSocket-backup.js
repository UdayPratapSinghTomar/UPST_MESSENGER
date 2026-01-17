const jwt = require('jsonwebtoken');
const { Op, where } = require('sequelize');
// const admin = require('../config/firebase');
const { User, ChatMember, Message, MessageStatus } = require('../models');
const EVENTS = require('../utils/socketEvents');
// const { addUser, removeUserBySocket } = require('../utils/onlineUsersRedis');
const messageStatus = require('../models/messageStatus');
module.exports = (io) => {

  // 🔐 SOCKET AUTH MIDDLEWARE
  io.use( (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token 
        || socket.handshake.query?.token;

      if (!token) return next(new Error('Token missing'));

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  // 🔌 SOCKET CONNECTION
  io.on(EVENTS.CONNECTION, async (socket) => {
    const userId = socket.user.id;
    console.log('User connected:', userId);

    await User.update(
      { is_online: true, last_seen: null },
      { where: { id: userId } }
    );

    // socket.on(EVENTS.USER_CONNECTED, async (user_id) => {
    //   await addUser(user_id, socket.id)
    //   console.log(`User ${user_id} online\n`);
    // })

    // Personal room (for notifications later)
    socket.join(`user_${userId}`);
    socket.emit(EVENTS.CONNECTED, { message: 'Socket connected' });

    // 🧩 JOIN CHAT ROOM
    socket.on(EVENTS.JOIN_CHAT, async (chat_id) => {
      try {
        if (!chat_id) {
          return socket.emit(EVENTS.SOCKET_ERROR, {
            message: 'chat_id is required',
          });
        }

        const isMember = await ChatMember.findOne({
          where: {
            chat_id,
            user_id: userId,
          },
        });

        if (!isMember) {
          return socket.emit(EVENTS.SOCKET_ERROR, {
            message: 'You are not a member of this chat',
          });
        }

        socket.join(`chat_${chat_id}`);
        socket.emit(EVENTS.JOINED_CHAT, { chat_id });

        console.log(`User ${userId} joined chat_${chat_id}`);

        // message delivered logic
        await MessageStatus.update(
          {
            status: 'delivered',
            delivered_at: new Date(),
          },
          {
            where: {
              chat_id,
              user_id: userId,
              status: 'sent',
            },
          }
        );

        // notify other users that messages were delivered
        // socket.to(`chat_${chat_id}`).emit(EVENTS.MESSAGE_DELIVERED, {
        //   chat_id,
        //   user_id: userId,
        // });

        // console.log(`User ${userId} joined chat_${chat_id}`);
      } catch (err) {
        socket.emit(EVENTS.SOCKET_ERROR, {
          message: 'Failed to join chat',
          error: err
        });
      }
    });

    // ✍️ TYPING
    // socket.on(EVENTS.TYPING, (chat_id) => {
    //   socket.to(`chat_${chat_id}`).emit('user_typing', {
    //     user_id: userId,
    //     chat_id,
    //   });
    // });

    // Stop typing
    // socket.on(EVENTS.STOP_TYPING, (chat_id) => {
    //   socket.to(`chat_${chat_id}`).emit('user_stop_typing', {
    //     user_id: userId,
    //     chat_id,
    //   });
    // });

    // 📩 SEND MESSAGE (TEXT / MEDIA)
    // socket.on(EVENTS.SEND_MESSAGE, async (data) => {
    //   try {
    //     const {
    //       chat_id,
    //       content,
    //       message_type = 'text',
    //       file = null,
    //       replied_to_message_id = null,
    //     } = data;

    //     // console.log('data ********* ',data);
    //     if (!chat_id) {
    //       return socket.emit(EVENTS.SOCKET_ERROR, {
    //         message: 'chat_id is required',
    //       });
    //     }

    //     const members = await ChatMember.findAll({
    //       where: { chat_id },
    //     });
    //     if (!members || members.length === 0) {
    //       return socket.emit(EVENTS.SOCKET_ERROR, {
    //         message: 'You are not a member of this chat',
    //       });
    //     }

    //     const message = await Message.create({
    //       chat_id,
    //       sender_id: userId,
    //       message_type,
    //       content: message_type === 'text' ? content: null,
    //       replied_to_message_id,
    //     });
        
    //     const sharedFile = null;
    //     if (message_type !== 'text' && file) {
    //       sharedFile = await SharedFile.create({
    //         message_id: message.id,
    //         chat_id,
    //         user_id: userId,
    //         file_name: file.file_name,
    //         file_url: file.file_url,
    //         file_type: file.file_type,
    //         file_size: file.file_size,
    //         mime_type: file.mime_type,
    //         duration: file.duration || null,
    //         thumbnail_url: file.thumbnail_url || null,
    //       });
    //     }
        
    //     await MessageStatus.bulkCreate(
    //       members.map((m) => ({
    //         message_id: message.id,
    //         user_id: m.user_id,
    //         chat_id: m.chat_id,
    //         status: 'sent',
    //       }))
    //     );

    //     if (message_type === 'text' && content) {
    //       const matches = content.match(/@(\w+)/g);
    //       if (matches) {
    //         const usernames = matches.map((u) => u.slice(1));
    //         const users = await User.findAll({ where: { username: usernames } });

    //         for (const user of users) {
    //           await MessageMention.create({
    //             message_id: message.id,
    //             mentioned_user_id: user.id,
    //           });

    //           if (user.fcmToken && user.id !== userId) {
    //             await admin.messaging().send({
    //               token: user.fcmToken,
    //               notification: {
    //                 title: 'You were mentioned',
    //                 body: content,
    //               },
    //               data: {
    //                 chat_id: String(chat_id),
    //                 message_id: message.id,
    //               },
    //             });
    //           }
    //         }
    //       }
    //     }
    //     // 🔔 PUSH NOTIFICATION (PHASE 9)
    //     for (const m of members) {
    //       if (m.user_id !== userId) {
    //         const user = await User.findByPk(m.user_id);
    //         if (user?.fcmToken) {
    //           await admin.messaging().send({
    //             token: user.fcmToken,
    //             notification: {
    //               title: 'New Message',
    //               body: content || 'Media message',
    //             },
    //             data: {
    //               chat_id: String(chat_id),
    //             },
    //           });
    //         }
    //       }
    //     }

    //     // 📢 EMIT MESSAGE
    //     io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, message);
        
    //   } catch (err) {
    //     console.error(err);
    //     socket.emit(EVENTS.SOCKET_ERROR, {
    //       message: err.message || 'Message send failed',
    //     });
    //   }
    // });

    // ✅ MESSAGE DELIVERED
    // socket.on(EVENTS.MESSAGE_DELIVERED, async ({ message_id }) => {
    //   await MessageStatus.update(
    //     { status: 'delivered' },
    //     {
    //       where: {
    //         message_id,
    //         user_id: userId,
    //         status: 'sent',
    //       },
    //     }
    //   );
    // });

    // 👁️ MESSAGE READ
    // socket.on(EVENTS.MESSAGE_READ, async ({ chat_id }) => {
    //   await MessageStatus.update(
    //     { 
    //       status: 'read',
    //       read_at: new Date(), 
    //     },
    //     {
    //       where: {
    //         chat_id,
    //         user_id: userId,
    //         status: { [Op.ne]: 'read' },
    //       },
    //     }
    //   );

    //   socket.to(`chat_${chat_id}`).emit(
    //     EVENTS.MESSAGE_READ_UPDATE,
    //     {
    //       chat_id,
    //       user_id: userId,
    //     }
    //   );
    // });

    // 🚪 LEAVE CHAT
    // socket.on(EVENTS.LEAVE_CHAT, ({ chat_id }) => {
    //   if (!chat_id) return;
    //   socket.leave(`chat_${chat_id}`);
    //   socket.emit(EVENTS.LEFT_CHAT, { chat_id });
    // });

    // 🔌 DISCONNECT
    socket.on(EVENTS.DISCONNECTED, async () => {
      await User.update(
        {
          is_online: false,
          last_seen: new Date(),
        },
        { where: { id: userId } }
      );

      // await removeUserBySocket(socket.id)
      console.log('User disconnected:', userId);
    });
  });
};
