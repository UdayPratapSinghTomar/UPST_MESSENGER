// const { Notification, UserDevice } = require('../models');
// const admin = require('../config/firebase');

// async function notifyUser(io, {
//   recipient_id,
//   sender_id = null,
//   chat_id,
//   message_id = null,
//   type,
//   event,
//   action,
//   title,
//   body
// }) {
//   try {

//     /**
//      * 1️⃣ Save notification
//      */
//     const notification = await Notification.create({
//       recipient_id,
//       sender_id,
//       chat_id,
//       message_id,
//       type,
//       event,
//       action,
//       title,
//       body
//     });

//     const room = `user_${recipient_id}`;

//     /**
//      * 2️⃣ Check if user is online
//      */
//     const sockets = await io.in(room).fetchSockets();
//     const isOnline = sockets.length > 0;

//     /**
//      * 3️⃣ If user online → realtime
//      */
//     if (isOnline) {

//       io.to(room).emit(event, {
//         notification_id: notification.id,
//         recipient_id,
//         sender_id,
//         chat_id,
//         message_id,
//         type,
//         action,
//         title,
//         body
//       });

//       return notification;
//     }

//     /**
//      * 4️⃣ Fetch user devices
//      */
//     const devices = await UserDevice.findAll({
//       where: {
//         user_id: recipient_id,
//         is_active: true
//       }
//     });

//     const tokens = devices
//       .map(d => d.fcm_token)
//       .filter(Boolean);

//     if (!tokens.length) return notification;

//     /**
//      * 5️⃣ Send FCM push
//      */
//     const response = await admin.messaging().sendEachForMulticast({
//       tokens,
//       notification: {
//         title,
//         body
//       },
//       data: {
//         chat_id: String(chat_id),
//         message_id: message_id ? String(message_id) : "",
//         type: type,
//         action
//       }
//     });

//     /**
//      * 6️⃣ Remove invalid tokens
//      */
//     const invalidTokens = [];

//     response.responses.forEach((res, idx) => {
//       if (!res.success) {
//         invalidTokens.push(tokens[idx]);
//       }
//     });

//     if (invalidTokens.length) {

//       await UserDevice.update(
//         { is_active: false },
//         {
//           where: {
//             fcm_token: invalidTokens
//           }
//         }
//       );

//     }

//     return notification;

//   } catch (err) {

//     console.error("notifyUser error:", err);
//     return null;

//   }
// }

// module.exports = { notifyUser };

// const { Notification, UserDevice } = require('../models');
// const admin = require('../config/firebase');
// const EVENTS = require('./socketEvents');

// async function notifyUser(io, {
//   recipient_ids, // 🔥 array
//   sender_id = null,
//   chat_id,
//   message_id = null,
//   type,
//   action,
//   title,
//   body
// }) {
//   try {
//     const event = EVENTS.NOTIFICATION;
//     // ✅ 1. Bulk insert notifications
//     const notificationsPayload = recipient_ids.map(recipient_id => ({
//       recipient_id,
//       sender_id,
//       chat_id,
//       message_id,
//       type,
//       event,
//       action,
//       title,
//       body
//     }));
//     // console.log(notificationsPayload);
//     const notifications = await Notification.bulkCreate(
//       notificationsPayload,
//       { returning: true }
//     );

//     // ✅ 2. Socket emit (only for online users)
//     await Promise.all(
//       recipient_ids.map(async (recipient_id, index) => {
//         const room = `user_${recipient_id}`;
//         const sockets = await io.in(room).fetchSockets();

//         if (sockets.length > 0) {
//           io.to(room).emit(event, {
//             action,
//             payload: {
//               id: notifications[index].id,
//               recipient_id,
//               sender_id,
//               chat_id,
//               message_id,
//               type,
//               title,
//               body
//             }
//           });
//         }
//       })
//     );

//     // ✅ 3. Fetch all device tokens at once
//     const devices = await UserDevice.findAll({
//       where: {
//         user_id: recipient_ids,
//         is_active: true
//       }
//     });

//     const tokens = devices.map(d => d.fcm_token).filter(Boolean);

//     if (tokens.length) {
//       await admin.messaging().sendEachForMulticast({
//         tokens,
//         notification: { title, body },
//         data: {
//           chat_id: String(chat_id),
//           message_id: message_id ? String(message_id) : "",
//           type,
//           action,
//           event
//         }
//       });
//     }

//     return notifications;

//   } catch (err) {
//     console.error("notifyUser error:", err);
//     return null;
//   }
// }

// module.exports = { notifyUser };


const { Notification, UserDevice } = require('../models');
const admin = require('../config/firebase');
const EVENTS = require('./socketEvents');

async function notifyUser(io, {
  recipient_ids,
  sender_id = null,
  chat_id,
  message_id = null,
  type,
  action,
  title,
  body
}) {
  try {
    const event = EVENTS.NOTIFICATION;

    // ✅ 1. Create notifications (DB)
    const notificationsPayload = recipient_ids.map(recipient_id => ({
      recipient_id,
      sender_id,
      chat_id,
      message_id,
      type,
      event,
      action,
      title,
      body
    }));

    const notifications = await Notification.bulkCreate(
      notificationsPayload,
      { returning: true }
    );

    // ✅ 2. Split ONLINE vs OFFLINE users
    const onlineUsers = [];
    const offlineUsers = [];

    await Promise.all(
      recipient_ids.map(async (recipient_id) => {
        const sockets = await io.in(`user_${recipient_id}`).fetchSockets();

        if (sockets.length > 0) {
          onlineUsers.push(recipient_id);
        } else {
          offlineUsers.push(recipient_id);
        }
      })
    );

    // ✅ 3. Socket emit → ONLY ONLINE users
    onlineUsers.forEach((recipient_id) => {
      const notification = notifications.find(n => n.recipient_id === recipient_id);

      io.to(`user_${recipient_id}`).emit(event, {
        action,
        payload: {
          id: notification.id,
          recipient_id,
          sender_id,
          chat_id,
          message_id,
          type,
          title,
          body
        }
      });
    });

    // ✅ 4. Push notification → ONLY OFFLINE users
    if (offlineUsers.length) {
      const devices = await UserDevice.findAll({
        where: {
          user_id: offlineUsers,
          is_active: true
        }
      });

      const tokens = devices.map(d => d.fcm_token).filter(Boolean);

      if (tokens.length) {
        await admin.messaging().sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: {
            chat_id: String(chat_id),
            message_id: message_id ? String(message_id) : "",
            type,
            action,
            event
          }
        });
      }
    }

    return notifications;

  } catch (err) {
    console.error("notifyUser error:", err);
    return null;
  }
}

module.exports = { notifyUser };