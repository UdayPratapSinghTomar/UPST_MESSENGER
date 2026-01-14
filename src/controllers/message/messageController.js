const { User, Message, MessageStatus, ChatMember } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response')
const db = require('../../models');
const EVENTS = require('../../utils/socketEvents');


exports.sendMessage = async (req, res) => {
  try{
    console.log('req----',req);
    const chat_id = req.body?.chat_id || req.params;
    const content = req.body?.content || null;
    let message_type = req.body?.message_type || 'text';

    const senderId = req.user.id;
    const io = req.app.get('io');

    const isMember = await ChatMember.findOne({
      where: { chat_id, user_id: senderId }
    });

    if(!isMember){
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Not a chat member')
    }

    const message = await Message.create({
      chat_id,
      sender_id: senderId,
      message_type,
      content: content || null,
    });

    let sharedFile = null;

    // 2️⃣ If media exists → store in shared_files
    if (req.files) {
      let file = null;

      if (req.files.file) {
        file = req.files.file[0];
        message_type = 'file';
      }
      if (req.files.video) {
        file = req.files.video[0];
        message_type = 'video';
      }
      if (req.files.audio) {
        file = req.files.audio[0];
        message_type = 'audio';
      }

      if (file) {
        const fileUrl = `/uploads/${file.filename}`;

        sharedFile = await SharedFile.create({
          message_id: message.id,
          chat_id,
          user_id: senderId,
          file_name: file.originalname,
          file_url: fileUrl,
          file_type: message_type,
          file_size: file.size,
          mime_type: file.mimetype
        });

        // update message_type if needed
        // await message.update({ message_type });
      }
    }

    const members = await ChatMember.findAll({
      where: { chat_id }
    });

    await MessageStatus.bulkCreate(
      members.map(m => ({
        message_id: message.id,
        chat_id,
        user_id: m.user_id,
        status: 'sent'
      }))
    );

     // 4️⃣ Socket payload
    const payload = {
      id: message.id,
      chat_id,
      sender_id: senderId,
      message_type: message.message_type,
      content: message.content,
      file: sharedFile,
      created_at: message.created_at
    };

    io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, payload);

    return sendResponse(res, HttpsStatus.CREATED, true, 'Message sent!', message );
  }catch(err){
    console.log('errrrrrrrr--------',err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
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
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        'Not authorized!'
      );
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
          model: MessageStatus,
          as: 'statuses',
          where: { user_id: currentUserId },
          required: false
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    // ✅ TRANSFORM RESPONSE (THIS IS THE KEY)
    const formattedMessages = messages.map(msg => {
      const isYou = msg.sender_id === currentUserId;

      return {
        id: msg.id,
        chat_id: msg.chat_id,
        content: msg.content,
        message_type: msg.message_type,
        created_at: msg.createdAt,

        sender_id: msg.sender_id,
        from: isYou ? 'you' : msg.sender?.full_name,
        is_you: isYou,

        status: msg.statuses?.[0]?.status || 'sent'
      };
    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      'Message retrieved successfully!',
      formattedMessages
    );

  } catch (err) {
    console.error('Fetch messages error:', err);
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      'Server error!',
      null,
      { server: err.message }
    );
  }
};