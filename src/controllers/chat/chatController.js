const express = require('express');
const { Chat, ChatMember, Message, User } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const db = require('../../models');

exports.createPrivateChat = async (req, res) => {
  try{
      const { user_id } = req.body;
      if (!user_id) {
          return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User id is required!');
      }
      const chat = await Chat.create({type: 'private', created_by: req.user.id});
      
      if (user_id == req.user.id) {
          return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'You cannot create a private chat with yourself');
      }
      const chatm = await ChatMember.bulkCreate([
          { chat_id: chat.id, user_id: req.user.id},
          { chat_id: chat.id, user_id}
      ]);
      
      return sendResponse(res, HttpsStatus.CREATED, true, 'Private chat created successfully!', chat, null )
  }catch(err){
    // console.log('error:',err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
}

exports.createGroup = async (req, res) => {
  try{
    const { group_name, members } = req.body;
    
    const chat = await Chat.create({
      type: 'group',
      group_name
    });

    const groupMembers = members.map(user_id => ({
      chat_id: chat.id,
      user_id,
      role: 'member'
    }));

    groupMembers.push({
      chat_id: chat.id,
      user_id: req.user.id,
      role: 'admin'
    });

    await ChatMember.bulkCreate(groupMembers);

    return sendResponse(res, HttpsStatus.CREATED, true, 'Group chat created successfully!', chat, null )
  }catch(err){
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
    return sendResponse(res, HttpsStatus.OK, true, "Messages retrieved!", messages);
  }catch(err){
    console.log("error",err)
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Serverd error!", null, { server: err.message});
  }
}
