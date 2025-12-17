const { Chat, ChatMember, Message, MessageStatus, User } = require('../../models')
const { Op } = require('sequelize')

exports.getChatList = async (req, res) => {
  try {
    const user_id = req.user.id

    // 1. All chats of user
    const chats = await Chat.findAll({
      include: [{
        model: ChatMember,
        where: { user_id }
      }]
    })

    const result = []

    for (const chat of chats) {
      // 2. Last message
      const lastMessage = await Message.findOne({
        where: { chat_id: chat.id },
        order: [['createdAt', 'DESC']],
        include: [{
          model: User,
          as: 'sender',
          attributes: ['id', 'name']
        }]
      })

      // 3. Unread count
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

      // 4. Chat name logic
      let chatName = chat.name

      if (chat.type === 'private') {
        const otherMember = await ChatMember.findOne({
          where: {
            chat_id: chat.id,
            user_id: { [Op.ne]: user_id }
          },
          include: [{ model: User }]
        })
        chatName = otherMember?.User?.name
      }

      result.push({
        chat_id: chat.id,
        type: chat.type,
        name: chatName,
        lastMessage,
        unreadCount
      })
    }

    // 5. Sort by last message
    result.sort((a, b) => {
      const t1 = a.lastMessage?.createdAt || 0
      const t2 = b.lastMessage?.createdAt || 0
      return new Date(t2) - new Date(t1)
    })

    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Chat list failed' })
  }
}
