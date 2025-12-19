const { User, Message, MessageStatus, ChatMember } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response')
const db = require('../../models');

exports.sendMessage = async (req, res) => {
  try{
    const {
        chat_id,
        content,
        message_type,
        file_url,
        replied_to_message_id
    } = req.body;

    const isMember = await ChatMember.findOne({
        where: { chat_id, user_id: req.user.id}
    });

    if(!isMember){
        return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Not a chat member')
    }

    const message = await Message.create({
        chat_id,
        sender_id: req.user.id,
        message_type,
        content,
        file_url,
        replied_to_message_id: replied_to_message_id || null
    });

    return sendResponse(res, HttpsStatus.CREATED, true, 'Message created successfully!', message, null )
  }catch(err){
    // console.log(err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
}

exports.getMessages = async (req, res) => {
  try {
    const { chat_id } = req.params;

    const isMember = await ChatMember.findOne({
      where: { chat_id, user_id: req.user.id }
    });

    if (!isMember) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Not authorized!');
    }

    const messages = await Message.findAll({
      where: { chat_id },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'full_name'] },
        { model: MessageStatus , as: 'MessageStatuses' } // alias must match association
      ],
      order: [
        [{ model: MessageStatus, as: 'MessageStatuses' }, 'created_at', 'ASC']
      ]
    });

    return sendResponse(res, HttpsStatus.OK, true, 'Message retrieved successfully!', messages);
  } catch (err) {
    console.error('Sequelize Error from get message *****************:', err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
};