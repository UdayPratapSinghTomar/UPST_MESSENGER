const { Notification, UserDevice } = require('../models');
const admin = require('../config/firebase');

async function notifyUser(io, {
  recipient_id,
  sender_id = null,
  chat_id,
  message_id = null,
  type,
  event,
  title,
  body
}) {

  // 1️⃣ Save notification in DB
  const notification = await Notification.create({
    recipient_id,
    sender_id,
    chat_id,
    message_id,
    type,
    event,
    title,
    body
  });

  const room = `user_${recipient_id}`;

  // 2️⃣ Emit real-time if online
  if (io.sockets.adapter.rooms.has(room)) {
    io.to(room).emit('notification', notification.toJSON());
    return notification;
  }

  // 3️⃣ If offline → Send FCM
  const devices = await UserDevice.findAll({
    where: { user_id: recipient_id, is_active: true }
  });

  const tokens = devices.map(d => d.fcm_token).filter(Boolean);

  if (!tokens.length) return notification;

  await admin.messaging().sendMulticast({
    tokens,
    notification: { title, body },
    data: {
      chat_id: String(chat_id),
      message_id: message_id ? String(message_id) : '',
      type: type
    }
  });

  return notification;
}

module.exports = { notifyUser };
