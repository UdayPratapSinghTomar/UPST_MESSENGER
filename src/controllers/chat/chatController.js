const express = require("express");
const { Chat, ChatMember, Message, User } = require("../../models");
const { sendResponse, HttpsStatus } = require("../../utils/response");
const db = require("../../models/index");

exports.createPrivateChat = async (req, res) => {
  try{
      const { user_id } = req.body;
      if (!user_id || !type) {
          return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "user_id and type are required");
      }

      const chat = await Chat.create({type: "private", created_by: user_id});

      if (Number(user_id) === Number(req.user.id)) {
          return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "You cannot create a private chat with yourself");
      }
      await ChatMember.bulkCreate([
          { chat_id: chat.id, user_id: req.user.id},
          { chat_id: chat.id, user_id}
      ]);

      return sendResponse(res, HttpsStatus.CREATED, true, "Private chat created successfully!", chat, null )
  }catch(err){
      return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
  }
}

exports.createGroup = async (req, res) => {
  try{
    const { group_name, members } = req.body;
    
    const chat = await Chat.create({
      type: "group",
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

    return sendResponse(res, HttpsStatus.CREATED, true, "Group chat created successfully!", chat, null )
  }catch(err){
    console.error("Sequelize Error:", err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
  }
}

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
        return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Not a chat member")
    }

    const message = await Message.create({
        chat_id,
        sender_id: req.user.id,
        message_type,
        content,
        file_url,
        replied_to_message_id
    });

    return sendResponse(res, HttpsStatus.CREATED, true, "Message created successfully!", message, null )
  }catch(err){
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
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
    return sendResponse(res, HttpsStatus.CREATED, true, "User added!", userCreate);
  } catch (err) {
    console.error("Sequelize Error:", err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
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

    return sendResponse(res, HttpsStatus.OK, true, "User removed!", removedUser);
  } catch (err) {
    console.error("Sequelize Error:", err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
  }
}

exports.getMessages = async (req, res) => {
  try {
    const { chat_id } = req.params;

    const isMember = await ChatMember.findOne({
      where: { chat_id, user_id: req.user.id }
    });

    if (!isMember) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Not authorized!");
    }

    const messages = await Message.findAll({
      where: { chat_id },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'full_name'] },
        { model: MessageStatus } // alias must match association
      ],
      order: [[db.sequelize.col('MessageStatus.created_at'), 'ASC']]
    });

    return sendResponse(res, HttpsStatus.OK, true, "Message retrieved successfully!", messages);
  } catch (err) {
    console.error("Sequelize Error:", err);
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
  }
};

// exports.createchat = async (req, res) => {
//     try {
//         const { type, name, member_ids } = req.body;
//         const creatorId = req.user.id;

//         // ---------- VALIDATION ----------
//         if (!type || !["private", "group"].includes(type)) {
//             return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "chat type must be private or group");
//         }

//         if (!Array.isArray(member_ids) || member_ids.length === 0) {
//             return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "member_ids must be a non-empty array");
//         }

//         if (type === "group" && !name) {
//             return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Group name is required");
//         }
        
//         // ---------- PRIVATE chat CHECK ----------
//         if (type === "private") {
//             const existingchat = await chat.findOne({
//                 where: { type: "private" },
//                 include: [{
//                     model: User,
//                     as: "members",
//                     where: { id: [creatorId, member_ids[0]] },
//                     through: { attributes: [] }
//                 }]
//             });

//             if (existingchat) {
//                 return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Private chat already exists",null, { chat: existingchat});
//             }
//         }

//         // ---------- CREATE chat ----------
//         const chat = await chat.create({
//             type,
//             name: type === "group" ? name : null,
//             created_by: creatorId
//         });

//         // ---------- ADD CREATOR ----------
//         await chatMember.create({
//             chat_id: chat.id,
//             user_id: creatorId,
//             role: type === "group" ? "admin" : "member"
//         });

//         // ---------- ADD MEMBERS ----------
//         for (const user_id of member_ids) {
//             if (user_id !== creatorId) {
//                 await chatMember.create({
//                     chat_id: chat.id,
//                     user_id: user_id,
//                     role: "member"
//                 });
//             }
//         }

//         return sendResponse(res, HttpsStatus.CREATED, true, "chat created successfully");

//     } catch (err) {
//         console.error("Create chat error:", err);
//         return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
//     }
// }

// exports.gerUserchats = async (req, res) => {
//     try {
//         const user_id = req.user.id;

//         const chats = await chat.findAll({
//             include: [{
//                 model: User,
//                 as: "members",
//                 where: { id: user_id },
//                 through: { attributes: [] }
//             }],
//             order: [["updated_at", "DESC"]]
//         });

//         return sendResponse(res, HttpsStatus.OK, true, "chat retrieved successfully!", chats, null)

//     } catch (err) {
//         console.error("Get chats error:",err);
//         return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
//     }
// }