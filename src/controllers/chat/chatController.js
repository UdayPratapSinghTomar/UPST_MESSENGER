const express = require('express');
const { sequelize, Chat, ChatMember, Message, MessageStatus, User } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const { getOnlineUsers } = require('../../utils/onlineUsersRedis');
const { Op } = require('sequelize');
const chatMembers = require('../../models/chatMembers');

exports.createPrivateChat = async (req, res) => {
  try{
      const { user_id } = req.body;
      if (!user_id) {
          return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User id is required!');
      }
            
      if (user_id == req.user.id) {
        return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'You cannot create a private chat with yourself!');
      }
      
      const existingChat = await Chat.findOne({
        where: { type: 'private' },
        include: [
          {
            model: ChatMember,
            as: 'memberships',
            required: true, // forces Inner Join
            where: {
              user_id: {
                [Op.in]: [user_id, req.user.id]
              }
            },
            attributes: []
          }
        ],
        group: ['Chat.id'],
        having: sequelize.literal(`COUNT(DISTINCT "memberships"."user_id") = 2`),
        subQuery: false // prevents sequelize from breaking group by in findone
      });
      if(existingChat){
        return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Private chat already exists!');
      }

      const t = await sequelize.transaction();
      try{
        const chat = await Chat.create({type: 'private', created_by: req.user.id}, { transaction: t });

        const chatMember = await ChatMember.bulkCreate([
            { chat_id: chat.id, user_id: req.user.id},
            { chat_id: chat.id, user_id}
        ],
        { transaction: t });
        
        await t.commit(); 

        return sendResponse(res, HttpsStatus.CREATED, true, 'Private chat created successfully!', chat, null )
      }catch(err){
        await t.rollback();
        // console.log('-------------------------------------error',err);
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
      }
  }catch(err){
    // console.log('-------------------------------------error',err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
}

exports.createGroup = async (req, res) => {
  try{
    const { group_name, group_members, } = req.body;
    
    const errors = {};
    if(!group_name){
      errors.group_name = 'Group name is required';
    }
    if(!Array.isArray(group_members)){
      errors.group_members = 'Chat members should be in array format';
    }else {
      if(group_members.length < 2){
      errors.group_members = 'At least 2 chat member is required!';
      }

      const uniqueMembers = new Set(group_members);
      if(uniqueMembers.size !== group_members.length){
        errors.group_members = 'Duplicate user IDs are not allowed in group_members';
      }

      if(group_members.includes(req.user.id)){
        errors.group_members = 'Admin user should not be included in group_members';
      }
    }

    if(Object.keys(errors).length > 0){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Validation failed!', null, errors);
    }

    const t = await sequelize.transaction();
    try{
      const chat = await Chat.create({
        type: 'group',
        group_name,
        created_by: req.user.id
      },
      { 
        transaction: t 
      });
  
      const groupMembers = group_members.map(user_id => ({
        chat_id: chat.id,
        user_id,
        role: 'member'
      }));
  
      groupMembers.push({
        chat_id: chat.id,
        user_id: req.user.id,
        role: 'admin'
      });
  
      const chatMember = await ChatMember.bulkCreate(groupMembers, { transaction: t });

      await t.commit();

      return sendResponse(res, HttpsStatus.CREATED, true, 'Group chat created successfully!', chat, null )
    }catch(err){
      await t.rollback();
      console.error('Sequelize Error:', err);
      return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
    }
  }catch(err){
    console.error('Sequelize Error:', err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
}

exports.addGroupMember = async (req, res) => {
  try {
    const { chat_id, user_id } = req.body
    const errors = {};
  
    if(!chat_id){
      errors.chat_id = 'Chat id is required';
    }
    if(!user_id){
      errors.user_id = 'User id is required';
    }

    if(Object.keys(errors).length > 0){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Missing fields!', null, errors);
    }

    const admin = await ChatMember.findOne({
      where: {
        chat_id,
        user_id: req.user.id,
        role: 'admin'
      }
    })
    
    if (!admin){
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Only admin have permission to add user!');
    }
    
    // const userExist = await ChatMember.findOne({
    //   where: {
    //     chat_id,
    //     user_id
    //   }
    // });

    // if(userExist){
    //   return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User already present in the group!');
    // }

    const userCreate = await ChatMember.create({
      chat_id,
      user_id,
      role: 'member'
    });

    return sendResponse(res, HttpsStatus.CREATED, true, 'User added!', userCreate);

  } catch (err) {
    // console.error('Sequelize Error:', err);

    if (err.name === 'SequelizeUniqueConstraintError') {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        'User already present in the group!'
      );
    }

    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
}

exports.removeGroupMember = async (req, res) => {
  try {
    const { chat_id, user_id } = req.body;

    const errors = {};
  
    if(!chat_id){
      errors.chat_id = 'Chat id is required';
    }
    if(!user_id){
      errors.user_id = 'User id is required';
    }

    if(Object.keys(errors).length > 0){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Missing fields!', null, errors);
    }

    const admin = await ChatMember.findOne({
      where: {
        chat_id,
        user_id: req.user.id,
        role: 'admin'
      }
    })

    if (!admin){
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Only admin have permission to remove user!');
    }

    const memberToRemove = await ChatMember.findOne({
        where: { chat_id, user_id },
        include: { model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }
    });

    if(!memberToRemove){
        return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User not found in group!');
    }
    const removedUser = await ChatMember.destroy({
      where: { chat_id, user_id }
    });

    return sendResponse(res, HttpsStatus.OK, true, 'User removed!', removedUser);
  } catch (err) {
    console.error('Sequelize Error:', err);

    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
}

exports.openChat = async (req, res) => {
  try{
    const { chat_id } = req.params;
    if(!chat_id){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Chat id is required!');
    }

    const messages = await Message.findAll({
      where : { chat_id }
    });

    return sendResponse(res, HttpsStatus.OK, true, 'Messages retrieved!', messages);
  }catch(err){
    console.log('error',err)
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Serverd error!', null, { server: err.message});
  }
}

// exports.getChatList = async (req, res) => {
//   try {
//     const user_id = req.user.id

//     if(!user_id){
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "User id is required!");
//     }
    
//     // console.log('---- userid *****',user_id)
//     // 1. Get chat_ids only
//     const chatMembers = await ChatMember.findAll({
//       where: { user_id },
//       attributes: ['chat_id']
//     });
    
//     const chat_ids = chatMembers.map(c => c.chat_id)
    
//     // console.log('chat_ids -----------------======================', chat_ids);
//     // 2. Fetch chats
//     const chats = await Chat.findAll({
//       where : { id: { [Op.in]: chat_ids } }
//     })

//     // console.log('chats -----------------======================', chats);
//     const chatList = []

//     for (const chat of chats) {

//       // 3. Last message (ANY sender)
//       const lastMessage = await Message.findOne({
//         where: { chat_id: chat.id },
//         order: [['created_at', 'DESC']],
//         include: [{
//           model: User,
//           as: 'sender',
//           attributes: ['id', 'full_name']
//         }]
//       })

//       // 4. Unread count
//       const unreadCount = await MessageStatus.count({
//         where: {
//           user_id,
//           status: { [Op.ne]: 'read' }
//         },
//         include: [{
//           model: Message,
//           where: {
//             chat_id: chat.id,
//             sender_id: { [Op.ne]: user_id }
//           }
//         }]
//       })

//       // 5. Chat name logic
//       let groupName = chat.group_name

//       if (chat.type === 'private') {
//         const otherMember = await ChatMember.findOne({
//           where: {
//             chat_id: chat.id,
//             user_id: { [Op.ne]: user_id }
//           },
//           include: [{ model: User, attributes: ['full_name'] }]
//         })
//         groupName = otherMember?.User?.full_name
//       }

//       chatList.push({
//         chat_id: chat.id,
//         type: chat.type,
//         group_name: groupName,
//         last_message: lastMessage,
//         unread_count: unreadCount
//       })
//     }

//     // 6. Sort by last message time
//     chatList.sort((a, b) => {
//       const t1 = a.last_message?.created_at || 0
//       const t2 = b.last_message?.created_at || 0
//       return new Date(t2) - new Date(t1)
//     })

//     // console.log('chat list    ============##################### ',chatList);

//     return sendResponse(res, HttpsStatus.OK, true, 'chat list retrieved!', chatList);
//   } catch (err) {
//     console.error(err)
//     return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
//   }
// }

exports.fetchChatList = async (req, res) => {
  try {
    const user_id = req.user.id;

    if (!user_id) {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        'User id is required!'
      );
    }

    /**
     * 1️⃣ Get chats where user is member
     */
    const chatMembers = await ChatMember.findAll({
      where: { user_id },
      attributes: ['chat_id'],
      include: [
        {
          model: Chat,
          as: 'chat',
          attributes: ['id', 'type', 'group_name', 'created_at'],
          include: [
            {
              model: ChatMember,
              as: 'memberships',
              attributes: ['user_id'],
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['id', 'full_name', 'profile_url', 'is_online']
                }
              ]
            }
          ]
        }
      ]
    });

    if (!chatMembers.length) {
      return sendResponse(res, HttpsStatus.OK, true, 'Chat list retrieved!', []);
    }

    const chatIds = chatMembers.map(cm => cm.chat_id);

    /**
     * 2️⃣ Fetch last message per chat
     */
    const lastMessages = await Message.findAll({
      where: {
        chat_id: { [Op.in]: chatIds }
      },
      attributes: [
        'chat_id',
        'content',
        'message_type',
        'sender_id',
        'created_at'
      ],
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'full_name']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const lastMessageMap = {};
    for (const msg of lastMessages) {
      if (!lastMessageMap[msg.chat_id]) {
        lastMessageMap[msg.chat_id] = msg;
      }
    }

    /**
     * 3️⃣ Unread count per chat
     */
    const unreadCounts = await MessageStatus.findAll({
      where: {
        user_id,
        status: { [Op.ne]: 'read' }
      },
      include: [
        {
          model: Message,
          as: 'message',
          attributes: ['chat_id'],
          where: {
            chat_id: { [Op.in]: chatIds },
            sender_id: { [Op.ne]: user_id }
          }
        }
      ]
    });

    const unreadMap = {};
    for (const row of unreadCounts) {
      const chatId = row.message.chat_id;
      unreadMap[chatId] = (unreadMap[chatId] || 0) + 1;
    }

    /**
     * 4️⃣ Build final response
     */
    const chatList = chatMembers.map(cm => {
      const chat = cm.chat;
      const lastMessage = lastMessageMap[chat.id] || null;
      
      let name = null;
      let profile_url = null;
      let is_online = false;

      if (chat.type === 'private') {
        // ✅ get other user
        const otherUser = chat.memberships
          .map(m => m.user)
          .find(u => u.id !== user_id);

        name = otherUser?.full_name || null;
        profile_url = otherUser?.profile_url || null;
        is_online =otherUser?.is_online || false;
      } else {
        // ✅ group chat
        name = chat.group_name;
        profile_url = null; // frontend default image
      }

      // console.log("lastMessage- ", lastMessage)
      const last_message = lastMessage
        ? {
            content: lastMessage.content,
            message_type: lastMessage.message_type,
            created_at: lastMessage?.dataValues?.created_at,
            sender_name:
              lastMessage.sender_id === user_id
                ? 'You'
                : lastMessage.sender?.full_name || null
          }
        : null;


      return {
        chat_id: chat.id,
        type: chat.type,
        name,
        profile_url,
        is_online,
        last_message,
        unread_count: unreadMap[chat.id] || 0
      };
    });

    /**
     * 5️⃣ Sort by last message time
     */
    chatList.sort((a, b) => {
      const t1 = a.last_message?.created_at || 0;
      const t2 = b.last_message?.created_at || 0;
      return new Date(t2) - new Date(t1);
    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      'Chat list retrieved!',
      chatList
    );

  } catch (err) {
    console.error('fetchChatList error:', err);
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

