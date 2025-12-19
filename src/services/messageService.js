const { Message, ChatMember } = require('../models');

const sendMessage = async ({
    Chat_id,
    sender_id,
    content,
    message_type = 'text',
}) => {
    // check user is memeber of Chat
    const isMember = await ChatMember.findOne({
        where: { Chat_id, user_id: sender_id },
    });

    if(!isMember){
        throw new Error('You are not a memeber of this Chat');
    }

    // save message
    const message = await Message.create({
        Chat_id,
        sender_id,
        content,
        message_type
    });

    return message;
};

module.exports = {
    sendMessage
}