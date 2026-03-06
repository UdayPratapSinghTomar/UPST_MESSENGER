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
  try
  {
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
    const onlineRoom = io.sockets.adapter.rooms.get(room);

    // ✅ If user online → realtime
    if (onlineRoom && onlineRoom.size > 0) {
      io.to(room).emit(event, notification.toJSON());
      return notification;
    }

    // ✅ If offline → FCM
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
  } catch (err) {
    console.error('notifyUser error:', err);
    return null;
  }
}

module.exports = { notifyUser };
