const { User, Message, MessageStatus, ChatMember } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response')
const db = require('../../models');
const EVENTS = require('../../utils/socketEvents');

exports.sendMessage = async (req, res) => {
  try{
    const {
        chat_id,
        content,
        message_type = 'text'
    } = req.body;

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
        content
    });

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

    io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, {
      id: message.id,
      chat_id,
      sender_id: senderId,
      content,
      created_at: message.created_at,
    });

    return sendResponse(res, HttpsStatus.CREATED, true, 'Message sent!', message );
  }catch(err){
    // console.log(err);
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