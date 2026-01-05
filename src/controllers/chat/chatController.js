const express = require('express');
const { sequelize, Chat, ChatMember, Message, MessageStatus, User } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const { getOnlineUsers } = require('../../utils/onlineUsersRedis');
const { Op } = require('sequelize');

exports.createPrivateChat = async (req, res) => {
  const t = await sequelize.transaction();
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
        subQuery: false, // prevents sequelize from breaking group by in findone
        transaction: t
      });
      if(existingChat){
        return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Private chat already exists!');
      }

      const chat = await Chat.create({type: 'private', created_by: req.user.id}, { transaction: t });
      const chatm = await ChatMember.bulkCreate([
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
}

exports.createGroup = async (req, res) => {
  const t = await sequelize.transaction();
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

    await ChatMember.bulkCreate(groupMembers, { transaction: t });
    await t.commit();

    return sendResponse(res, HttpsStatus.CREATED, true, 'Group chat created successfully!', chat, null )
  }catch(err){
    await t.rollback();
    console.error('Sequelize Error:', err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
}

exports.addGroupMember = async (req, res) => {
  try {
    const { chat_id, user_id } = req.body

    const admin = await ChatMember.findOne({
      where: {
        chat_id,
        user_id: req.user.id,
        role: 'admin'
      }
    })

    if (!admin)
      return res.status(403).json({ message: 'Only admin allowed' })

    const userCreate = await ChatMember.create({
      chat_id,
      user_id,
      role: 'member'
    })
    return sendResponse(res, HttpsStatus.CREATED, true, 'User added!', userCreate);
  } catch (err) {
    console.error('Sequelize Error:', err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
}

exports.removeGroupMember = async (req, res) => {
  try {
    const { chat_id, user_id } = req.body

    const admin = await ChatMember.findOne({
      where: {
        chat_id,
        user_id: req.user.id,
        role: 'admin'
      }
    })

    if (!admin)
      return res.status(403).json({ message: 'Only admin allowed' })

    const removedUser = await ChatMember.destroy({
      where: { chat_id, user_id }
    })

    return sendResponse(res, HttpsStatus.OK, true, 'User removed!', removedUser);
  } catch (err) {
    console.error('Sequelize Error:', err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
}

exports.openChat = async (req, res) => {
  try{
    const { chat_id } = req.params;
    const messages = await Message.findAll({
      where : { chat_id },
      include
    });
    return sendResponse(res, HttpsStatus.OK, true, 'Messages retrieved!', messages);
  }catch(err){
    console.log('error',err)
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Serverd error!', null, { server: err.message});
  }
}

exports.getChatList = async (req, res) => {
  try {
    const user_id = req.user.id
    // console.log('---- userid *****',user_id)
    // 1. Get chat_ids only
    const chatMembers = await ChatMember.findAll({
      where: { user_id },
      attributes: ['chat_id']
    });
    
    const chat_ids = chatMembers.map(c => c.chat_id)
    
    // console.log('chat_ids -----------------======================', chat_ids);
    // 2. Fetch chats
    const chats = await Chat.findAll({
      where : { id: { [Op.in]: chat_ids } }
    })

    // console.log('chats -----------------======================', chats);
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

    // console.log('chat list    ============##################### ',chatList);

    return sendResponse(res, HttpsStatus.OK, true, 'chat list retrieved!', chatList);
  } catch (err) {
    console.error(err)
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
  }
}

exports.getActiveUsers = async (req, res) => {
    try{
        const currentUserId = req.user.id;
        const onlineUserIds = await getOnlineUsers();
        // console.log('onlineUserIds***********',onlineUserIds)

        const users = await User.findAll({
            where: {
                id: onlineUserIds.filter(id => id !== currentUserId)
            },
            attributes: ['id', 'full_name', 'profile_url']
        });

        return sendResponse(res, HttpsStatus.OK, true, 'Online users!', users);
    }catch(err){
        console.log(err);
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
    }
}