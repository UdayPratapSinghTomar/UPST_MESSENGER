const express = require('express');
const { sequelize, Chat, ChatMember, Message, MessageStatus, User, SharedFile } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const { getOnlineUsers } = require('../../utils/onlineUsersRedis');
const { Op } = require('sequelize');
const EVENT = require('../../utils/socketEvents');
const { notifyUser } = require('../../utils/notificationService');
const path = require('path');
const fs = require('fs');

exports.createPrivateChat = async (req, res) => {
  const t = await sequelize.transaction();

  try{
    const { user_id } = req.body;
    const currentUserId = req.user.id;
    const io = req.app.get('io');

    if (!user_id) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User id is required!');
    }
          
    if (user_id == currentUserId) {
      await t.rollback();
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
              [Op.in]: [user_id, currentUserId]
            }
          },
          attributes: []
        }
      ],
      group: ['Chat.id'],
      having: sequelize.literal(`COUNT(DISTINCT "memberships"."user_id") = 2`),
      subQuery: false // prEVENTs sequelize from breaking group by in findone
    });

    if(existingChat){
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Private chat already exists!');
    }

    const chat = await Chat.create({type: 'private', created_by: currentUserId}, { transaction: t });

    const chatMember = await ChatMember.bulkCreate([
        { chat_id: chat.id, user_id: currentUserId},
        { chat_id: chat.id, user_id}
    ],
    { transaction: t });
    
    await t.commit(); 

    const chatPayload = {
      id: chat.id,
      type: chat.type,
      created_by: currentUserId,
      members: [currentUserId, user_id],
      last_message: null,
      unread_count: 0,
      created_at: chat.createdAt,
    };

    // Emit chat created to both users
    io.to(`user_${currentUserId}`).emit(EVENT.CHAT_CREATED, chatPayload);
    io.to(`user_${currentUserId}`).emit(EVENT.CHAT_LIST_UPDATE, {
      action: "new_chat",
      chat: chatPayload
    });

    // Check if other user online
    const otherRoom = io.sockets.adapter.rooms.get(`user_${user_id}`);
    const isOnline = otherRoom && otherRoom.size > 0;

    if (isOnline) {

      io.to(`user_${user_id}`).emit(EVENT.CHAT_CREATED, chatPayload);
      io.to(`user_${user_id}`).emit(EVENT.CHAT_LIST_UPDATE, {
        action: "new_chat",
        chat: chatPayload
      });

    } else {

      await notifyUser(io, {
        recipient_id: user_id,
        sender_id: currentUserId,
        chat_id: chat.id,
        type: "chat",
        event: EVENT.NOTIFICATION,
        title: "New Chat Created",
        body: "A private chat has been created with you"
      });
    }

    return sendResponse(res, HttpsStatus.CREATED, true, 'Private chat created successfully!', {chat}, null )
    // return sendResponse(res, HttpsStatus.CREATED, true, 'Private chat created successfully!', payload, null )
  }catch(err){
    if(!t.finished){
      await t.rollback();
    }
    console.log('error',err)
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
}

exports.createGroup = async (req, res) => {
  const t = await sequelize.transaction();

  try{
    const { group_name, group_members, } = req.body;
    const currentUserId = req.user.id;
    const io =req.app.get('io');

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

      if(group_members.includes(currentUserId)){
        errors.group_members = 'Admin user should not be included in group_members';
      }
    }

    if(Object.keys(errors).length > 0){
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Validation failed!', null, errors);
    }

    const chat = await Chat.create({
      type: 'group',
      group_name,
      created_by: currentUserId
    },
    { 
      transaction: t  
    });

    const defaultFileUrl = '/uploads/default/group_image.png';
    const defaultFilePath = path.join(__dirname,'../../uploads/default/group_image.png');

    if (fs.existsSync(defaultFilePath)) {
      const stats = fs.statSync(defaultFilePath);

      await SharedFile.create(
      {
          chat_id: chat.id,
          file_name: 'group_image.png',
          file_url: defaultFileUrl,
          file_type: 'image',
          file_size: stats.size,
          mime_type: 'image/jpeg',
      },
      {
          transaction: t,
      }
      );
    }

    const groupMembers = group_members.map(user_id => ({
      chat_id: chat.id,
      user_id,
      role: 'member'
    }));

    groupMembers.push({
      chat_id: chat.id,
      user_id: currentUserId,
      role: 'admin'
    });

    const chatMember = await ChatMember.bulkCreate(groupMembers, { transaction: t });

    await t.commit();

    const groupPayload = {
      id: chat.id,
      type: 'group',
      group_name,
      created_by: currentUserId,
      members: allMembers,
      created_at: chat.createdAt,
      last_message: null,
      unread_count: 0
    };

    const allMembers = [...group_members, currentUserId];
    
    const notifications = [];
    for (const userId of allMembers) {

      io.to(`user_${userId}`).emit(EVENT.CHAT_CREATED, groupPayload);
      io.to(`user_${userId}`).emit(EVENT.CHAT_LIST_UPDATE);

      if (userId !== currentUserId) {
        await notifyUser(io, {
          recipient_id: userId,
          sender_id: currentUserId,
          chat_id: chat.id,
          type: 'group',
          event: EVENT.CHAT_CREATED,
          title: 'Added to Group',
          body: `You were added to ${group_name}`
        });
      }
    }

    return sendResponse(res, HttpsStatus.CREATED, true, 'Group chat created successfully!',{chat: chat, notifications: notifications}, null )
  }catch(err){
    await t.rollback();
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
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message});
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

exports.chatList = async (req, res) => {
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

exports.allPrivateChats = async (req, res) => {
  try {
    const user_id = req.user.id;

    if (!user_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User id is required!');
    }

    const chatMembers = await ChatMember.findAll({
      where: { user_id },
      attributes: ['chat_id'],
      include: [
        {
          model: Chat,
          as: 'chat',
          where: { type: 'private' },
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
      return sendResponse(res, HttpsStatus.OK, true, 'Private chat list retrieved!', []);
    }

    const chatIds = chatMembers.map(cm => cm.chat_id);

    const lastMessages = await Message.findAll({
      where: { chat_id: { [Op.in]: chatIds } },
      attributes: ['chat_id', 'content', 'message_type', 'sender_id', 'created_at'],
      include: [{ model: User, as: 'sender', attributes: ['id', 'full_name'] }],
      order: [['created_at', 'DESC']]
    });

    const lastMessageMap = {};
    for (const msg of lastMessages) {
      if (!lastMessageMap[msg.chat_id]) lastMessageMap[msg.chat_id] = msg;
    }

    const unreadCounts = await MessageStatus.findAll({
      where: { user_id, status: { [Op.ne]: 'read' } },
      include: [
        {
          model: Message,
          as: 'message',
          attributes: ['chat_id'],
          where: { chat_id: { [Op.in]: chatIds }, sender_id: { [Op.ne]: user_id } }
        }
      ]
    });

    const unreadMap = {};
    for (const row of unreadCounts) {
      const chatId = row.message.chat_id;
      unreadMap[chatId] = (unreadMap[chatId] || 0) + 1;
    }

    const privateChats = chatMembers.map(cm => {
      const chat = cm.chat;
      const lastMessage = lastMessageMap[chat.id] || null;

      const otherUser = chat.memberships
        .map(m => m.user)
        .find(u => u.id !== user_id);

      const last_message = lastMessage
        ? {
            content: lastMessage.content,
            message_type: lastMessage.message_type,
            created_at: lastMessage?.dataValues?.created_at,
            sender_name: lastMessage.sender_id === user_id ? 'You' : lastMessage.sender?.full_name || null
          }
        : null;

      return {
        chat_id: chat.id,
        type: chat.type,
        name: otherUser?.full_name || null,
        profile_url: otherUser?.profile_url || null,
        is_online: otherUser?.is_online || false,
        last_message,
        unread_count: unreadMap[chat.id] || 0
      };
    });

    // Sort by last message
    privateChats.sort((a, b) => {
      const t1 = a.last_message?.created_at || 0;
      const t2 = b.last_message?.created_at || 0;
      return new Date(t2) - new Date(t1);
    });

    return sendResponse(res, HttpsStatus.OK, true, 'Private chat list retrieved!', privateChats);

  } catch (err) {
    console.error('fetchPrivateChats error:', err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
};

exports.allGroupChats = async (req, res) => {
  try {
    const user_id = req.user.id;

    if (!user_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User id is required!');
    }

    const chatMembers = await ChatMember.findAll({
      where: { user_id },
      attributes: ['chat_id'],
      include: [
        {
          model: Chat,
          as: 'chat',
          where: { type: 'group' },
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
            },
            {
              model: SharedFile,
              as: 'files',
              attributes: ['file_url'],
              where: { file_type: 'group_profile' }, // assume type for group profile
              required: false
            }
          ]
        }
      ]
    });

    if (!chatMembers.length) {
      return sendResponse(res, HttpsStatus.OK, true, 'Group chat list retrieved!', []);
    }

    const chatIds = chatMembers.map(cm => cm.chat_id);

    const lastMessages = await Message.findAll({
      where: { chat_id: { [Op.in]: chatIds } },
      attributes: ['chat_id', 'content', 'message_type', 'sender_id', 'created_at'],
      include: [{ model: User, as: 'sender', attributes: ['id', 'full_name'] }],
      order: [['created_at', 'DESC']]
    });

    const lastMessageMap = {};
    for (const msg of lastMessages) {
      if (!lastMessageMap[msg.chat_id]) lastMessageMap[msg.chat_id] = msg;
    }

    const unreadCounts = await MessageStatus.findAll({
      where: { user_id, status: { [Op.ne]: 'read' } },
      include: [
        {
          model: Message,
          as: 'message',
          attributes: ['chat_id'],
          where: { chat_id: { [Op.in]: chatIds }, sender_id: { [Op.ne]: user_id } }
        }
      ]
    });

    const unreadMap = {};
    for (const row of unreadCounts) {
      const chatId = row.message.chat_id;
      unreadMap[chatId] = (unreadMap[chatId] || 0) + 1;
    }

    const groupChats = chatMembers.map(cm => {
      const chat = cm.chat;
      const lastMessage = lastMessageMap[chat.id] || null;

      const last_message = lastMessage
        ? {
            content: lastMessage.content,
            message_type: lastMessage.message_type,
            created_at: lastMessage?.dataValues?.created_at,
            sender_name: lastMessage.sender_id === user_id ? 'You' : lastMessage.sender?.full_name || null
          }
        : null;

      return {
        chat_id: chat.id,
        type: chat.type,
        name: chat.group_name,
        profile_url: chat.files?.[0]?.file_url || null,
        is_online: false,
        last_message,
        unread_count: unreadMap[chat.id] || 0
      };
    });

    // Sort by last message
    groupChats.sort((a, b) => {
      const t1 = a.last_message?.created_at || 0;
      const t2 = b.last_message?.created_at || 0;
      return new Date(t2) - new Date(t1);
    });

    return sendResponse(res, HttpsStatus.OK, true, 'Group chat list retrieved!', groupChats);

  } catch (err) {
    console.error('fetchGroupChats error:', err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
};

exports.chatHistory = async (req, res) => {
  try {
    const { chat_id } = req.params;
    const currentUserId = req.user.id;

    const isMember = await ChatMember.findOne({
      where: { chat_id, user_id: currentUserId },
    });

    if (!isMember) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Not authorized!");
    }

    const messages = await Message.findAll({
      where: { chat_id },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "full_name"],
        },
        {
          model: SharedFile,
          as: "files", // include shared file attachments
          required: false,
        },
        {
          model: MessageStatus,
          as: "statuses",
          where: { user_id: currentUserId },
          required: false,
        },
      ],
      order: [["created_at", "ASC"]],
    });

    const formattedMessages = messages.map((msg) => {
      const isYou = msg.sender_id === currentUserId;

      return {
        id: msg.id,
        chat_id: msg.chat_id,
        content: msg.content,
        message_type: msg.message_type,
        created_at: msg.createdAt,

        sender_id: msg.sender_id,
        // from: isYou ? "you" : msg.sender?.full_name,
        is_you: isYou,

        status: msg.statuses?.[0]?.status || "sent",

        files:
          msg.files?.map((file) => ({
            id: file.id,
            file_name: file.file_name,
            file_url: file.file_url,
            file_type: file.file_type,
            mime_type: file.mime_type,
            file_size: file.file_size,
            thumbnail_url: file.thumbnail_url,
            duration: file.duration,
          })) || [],
      };
    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Messages retrieved successfully!",
      formattedMessages,
    );
  } catch (err) {
    console.error("Fetch messages error:", err);
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      { server: err.message },
    );
  }
};

exports.groupDetails = async (req, res) => {
  try {
    const { chat_id } = req.params;

    if (!chat_id) {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        'Chat id is required'
      );
    }

    // 1️⃣ Check requester is a group member
    const isMember = await ChatMember.findOne({
      where: {
        chat_id,
        user_id: req.user.id
      }
    });

    if (!isMember) {
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        'You are not a member of this group'
      );
    }

    // 2️⃣ Fetch group with memberships + shared files
    const group = await Chat.findOne({
      where: {
        id: chat_id,
        type: 'group',
        is_deleted: false
      },
      attributes: [
        'id',
        'group_name',
        'group_image',
        'created_by',
        ['created_at', 'createdAt'] // alias for reliable access
      ],
      include: [
        {
          model: ChatMember,
          as: 'memberships',
          attributes: ['role', 'joined_at', 'muted'],
          include: [
            {
              model: User,
              as: 'user',
              attributes: [
                'id',
                'full_name',
                'designation',
                'position',
                'profile_url',
                'is_online',
                'last_seen'
              ]
            }
          ]
        },
        {
          model: SharedFile,
          as: 'files',
          attributes: ['id', 'file_name', 'file_url', 'file_type', 'created_at'],
          include: [
            {
              model: User,
              as: 'uploader',
              attributes: ['id', 'full_name', 'profile_url']
            }
          ]
        }
      ]
    });

    if (!group) {
      return sendResponse(
        res,
        HttpsStatus.NOT_FOUND,
        false,
        'Group not found'
      );
    }

    // 3️⃣ Normalize response
    const memberships = group.memberships || [];
    const sharedFiles = group.files || [];

    console.log(group)
    const response = {
      group_id: group.id,
      group_name: group.group_name,
      group_image: group.group_image,
      created_at: group.createdAt,
      created_by: group.created_by,
      total_members: memberships.length,
      members: memberships.map(m => ({
        id: m.user.id,
        name: m.user.full_name,
        designation: m.user.designation,
        position: m.user.position,
        profile_url: m.user.profile_url,
        role: m.role,
        joined_at: m.joined_at,
        muted: m.muted,
        is_online: m.user.is_online,
        last_seen: m.user.last_seen
      })),
      profile_image: sharedFiles.map(f => ({
        id: f.id,
        file_name: f.file_name,
        file_url: f.file_url,
        file_type: f.file_type,
        created_at: f.created_at,
        uploaded_by: {
          id: f.uploader?.id,
          name: f.uploader?.full_name,
          profile_url: f.uploader?.profile_url
        }
      }))
    };

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      'Group details fetched successfully',
      response
    );

  } catch (err) {
    console.error('groupDetails error:', err);
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