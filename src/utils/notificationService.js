const { Notification, UserDevice } = require('../models');
const admin = require('../config/firebase'); // firebase-admin
const io = require('../socket'); // exported socket instance

async function notifyUser({
  recipient_id,
  sender_id = null,
  chat_id,
  message_id = null,
  type,
  event,
  title,
  body
}) {
  // 1️⃣ Save notification
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

  // 2️⃣ Check socket online
  const room = `user_${recipient_id}`;
  const isOnline = io.sockets.adapter.rooms.has(room);

  if (isOnline) {
    io.to(room).emit('notification:new', notification);
    return;
  }

  // 3️⃣ Offline → Firebase
  const devices = await UserDevice.findAll({
    where: { user_id: recipient_id, is_active: true }
  });

  const tokens = devices.map(d => d.fcm_token).filter(Boolean);

  if (!tokens.length) return;

  await admin.messaging().sendMulticast({
    tokens,
    notification: {
      title,
      body
    },
    data: {
      chat_id: String(chat_id),
      message_id: message_id ? String(message_id) : ''
    }
  });
}

module.exports = { notifyUser };
