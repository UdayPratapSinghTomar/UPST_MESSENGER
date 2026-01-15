const { User, Message, MessageStatus, ChatMember, SharedFile } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response')
const db = require('../../models');
const EVENTS = require('../../utils/socketEvents');

exports.sendMessage = async (req, res) => {
  const t = await db.sequelize.transaction();

  try {
    const { chat_id, content } = req.body;
    const senderId = req.user.id;
    const io = req.app.get('io');

    if (!chat_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Chat id is required');
    }

    const isMember = await ChatMember.findOne({
      where: { chat_id, user_id: senderId }
    });

    if (!isMember) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Not a chat member');
    }

    const members = await ChatMember.findAll({ where: { chat_id } });

    const messagesPayload = [];

    // ❗ TEXT ONLY (no files)
    if (!req.files || req.files.length === 0) {
      const message = await Message.create({
        chat_id,
        sender_id: senderId,
        message_type: 'text',
        content
      }, { transaction: t });

      await MessageStatus.bulkCreate(
        members.map(m => ({
          message_id: message.id,
          user_id: m.user_id,
          chat_id,
          status: 'sent'
        })),
        { transaction: t }
      );

      const textPayload = {
        id: message.id,
        chat_id,
        sender_id: senderId,
        message_type: 'text',
        content,
        file: null,
        created_at: message.created_at
      };

      io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, textPayload);

      await t.commit();
      return sendResponse(res, HttpsStatus.CREATED, true, 'Message created!', textPayload);
    }

    // ❗ FILES PRESENT
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let messageType = "file";
        if (file.mimetype.startsWith("image")) messageType = "image";
        if (file.mimetype.startsWith("video")) messageType = "video";
        if (file.mimetype.startsWith("audio")) messageType = "audio";

        const message = await Message.create({
          chat_id,
          sender_id: senderId,
          message_type: messageType,
          content: content || null
        }, { transaction: t });

        const fileUrl = `/uploads/${file.filename}`;

        const sharedFile = await SharedFile.create({
          message_id: message.id,
          chat_id,
          user_id: senderId,
          file_name: file.originalname,
          file_url: fileUrl,
          file_type: messageType,
          file_size: file.size,
          mime_type: file.mimetype
        }, { transaction: t });

        await MessageStatus.bulkCreate(
          members.map(m => ({
            message_id: message.id,
            user_id: m.user_id,
            chat_id,
            status: "sent"
          })),
          { transaction: t }
        );

        messagesPayload.push({
          id: message.id,
          chat_id,
          sender_id: senderId,
          message_type: messageType,
          content: content || null,
          file: sharedFile,
          created_at: message.created_at
        });
      }

      io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, messagesPayload);

      await t.commit();
      return sendResponse(
        res,
        HttpsStatus.CREATED,
        true,
        'Messages created!',
        messagesPayload
      );
    }

  } catch (err) {
    await t.rollback();
    return sendResponse(res, 500, false, 'Server error', null, { server: err.message });
  }
};

exports.deliveredMessage = async (req, res) => {
  try{

  }catch(err){

  }
}

exports.fetchMessages = async (req, res) => {
  try {
    const { chat_id } = req.params;
    const currentUserId = req.user.id;

    const isMember = await ChatMember.findOne({
      where: { chat_id, user_id: currentUserId }
    });

    if (!isMember) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Not authorized!');
    }

    const messages = await Message.findAll({
      where: { chat_id },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'full_name']
        },
        {
          model: SharedFile,
          as: 'files',  // include shared file attachments
          required: false
        },
        {
          model: MessageStatus,
          as: 'statuses',
          where: { user_id: currentUserId },
          required: false
        }
      ],
      order: [['created_at', 'ASC']]
    });

    const formattedMessages = messages.map(msg => {
      const isYou = msg.sender_id === currentUserId;

      return {
        id: msg.id,
        chat_id: msg.chat_id,
        content: msg.content,
        message_type: msg.message_type,
        created_at: msg.created_at,

        sender_id: msg.sender_id,
        from: isYou ? 'you' : msg.sender?.full_name,
        is_you: isYou,

        status: msg.statuses?.[0]?.status || 'sent',

        files: msg.files?.map(file => ({
          id: file.id,
          file_name: file.file_name,
          file_url: file.file_url,
          file_type: file.file_type,
          mime_type: file.mime_type,
          file_size: file.file_size,
          thumbnail_url: file.thumbnail_url,
          duration: file.duration
        })) || []
      };
    });

    return sendResponse(res, HttpsStatus.OK, true, 'Messages retrieved successfully!', formattedMessages);

  } catch (err) {
    console.error('Fetch messages error:', err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
};