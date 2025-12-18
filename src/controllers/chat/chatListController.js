const { Chat, ChatMember, Message, MessageStatus, User } = require('../../models')
const { Op } = require('sequelize')
const { sendResponse, HttpsStatus } = require('../../utils/response')

exports.getChatList = async (req, res) => {
  try {
    const user_id = req.user.id
    console.log("---- userid *****",user_id)
    // 1. Get chat_ids only
    const chatMembers = await ChatMember.findAll({
      where: { user_id },
      attributes: ['chat_id']
    });
    
    const chat_ids = chatMembers.map(c => c.chat_id)
    
    console.log("chat_ids -----------------======================", chat_ids);
    // 2. Fetch chats
    const chats = await Chat.findAll({
      where : { id: { [Op.in]: chat_ids } }
    })

    console.log("chats -----------------======================", chats);
    const chatList = []

    for (const chat of chats) {

      // 3. Last message (ANY sender)
      const lastMessage = await Message.findOne({
        where: { chat_id: chat.id },
        order: [['created_at', 'DESC']],
        include: [{
          model: User,
          as: 'sender',
          attributes: ['id', 'full_name']
        }]
      })

      // 4. Unread count
      const unreadCount = await MessageStatus.count({
        where: {
          user_id,
          status: { [Op.ne]: 'read' }
        },
        include: [{
          model: Message,
          where: {
            chat_id: chat.id,
            sender_id: { [Op.ne]: user_id }
          }
        }]
      })

      // 5. Chat name logic
      let groupName = chat.group_name

      if (chat.type === 'private') {
        const otherMember = await ChatMember.findOne({
          where: {
            chat_id: chat.id,
            user_id: { [Op.ne]: user_id }
          },
          include: [{ model: User, attributes: ['full_name'] }]
        })
        groupName = otherMember?.User?.full_name
      }

      chatList.push({
        chat_id: chat.id,
        type: chat.type,
        group_name: groupName,
        last_message: lastMessage,
        unread_count: unreadCount
      })
    }

    // 6. Sort by last message time
    chatList.sort((a, b) => {
      const t1 = a.last_message?.created_at || 0
      const t2 = b.last_message?.created_at || 0
      return new Date(t2) - new Date(t1)
    })

    console.log("chat list    ============##################### ",chatList);

    return sendResponse(res, HttpsStatus.OK, true, "chat list retrieved!", chatList);
  } catch (err) {
    console.error(err)
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, err.message);
  }
}
