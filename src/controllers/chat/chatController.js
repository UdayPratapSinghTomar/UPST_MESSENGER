const express = require('express');
const { sequelize, Chat, ChatMember, Message, MessageStatus, User, SharedFile } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const { getOnlineUsers } = require('../../utils/onlineUsersRedis');
const { Op } = require('sequelize');
const EVENTS = require('../../utils/socketEvents');
const { notifyUser } = require('../../utils/notificationService');
const path = require('path');
const fs = require('fs');

// exports.createPrivateChat = async (req, res) => {

//   const t = await sequelize.transaction();

//   try {

//     const { user_id } = req.body;
//     const currentUserId = req.user.id;
//     const org_id = req.org_id;
//     const io = req.app.get('io');

//     if (!user_id) {
//       await t.rollback();
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User id is required!');
//     }

//     if (user_id === currentUserId) {
//       await t.rollback();
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'You cannot create a private chat with yourself!');
//     }

//     /**
//      * Validate user belongs to same organization
//      */
//     const targetUser = await User.findOne({
//       where: { id: user_id, is_deleted: false },
//       [Op.or]: [
//         { organization_id: org_id },
//         { org_2: org_id },
//         { org_3: org_id },
//         { org_4: org_id },
//         { org_5: org_id },
//         { org_6: org_id },
//         { org_7: org_id },
//         { org_8: org_id },
//         { org_9: org_id },
//         { org_10: org_id }
//       ]
//     });

//     if (!targetUser) {
//       await t.rollback();
//       return sendResponse(res, HttpsStatus.NOT_FOUND, false, 'User not found!');
//     }

//     /**
//      * Check existing private chat
//      */
//     const existingChat = await Chat.findOne({
//       where: {
//         type: 'private',
//         organization_id: org_id,
//         is_deleted: false
//       },
//       include: [
//         {
//           model: ChatMember,
//           as: 'memberships',
//           where: { user_id: { [Op.in]: [user_id, currentUserId] } },
//           attributes: []
//         }
//       ],
//       group: ['Chat.id'],
//       having: sequelize.literal(`COUNT(DISTINCT "memberships"."user_id") = 2`),
//       subQuery: false
//     });

//     if (existingChat) {
//       await t.rollback();
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Private chat already exists!');
//     }

//     /**
//      * Create chat
//      */
//     const chat = await Chat.create({
//       type: 'private',
//       created_by: currentUserId,
//       organization_id: org_id
//     }, { transaction: t });

//     await ChatMember.bulkCreate([
//       { chat_id: chat.id, user_id: currentUserId },
//       { chat_id: chat.id, user_id }
//     ], { transaction: t });

//     await t.commit();

//     const users = [currentUserId, user_id];

//     const chatPayload = {
//       id: chat.id,
//       type: 'private',
//       created_by: currentUserId,
//       members: users,
//       created_at: chat.createdAt,
//       last_message: null,
//       unread_count: 0
//     };

//     for (const uid of users) {

//       io.to(`user_${uid}`).emit(EVENTS.CHAT_CREATED, chatPayload);

//       io.to(`user_${uid}`).emit(EVENTS.CHAT_LIST_UPDATE, {
//         action: 'new_chat',
//         data: chatPayload
//       });

//       if (uid === currentUserId) continue;

//       await notifyUser(io, {
//         recipient_id: uid,
//         sender_id: currentUserId,
//         chat_id: chat.id,
//         type: 'chat',
//         event: EVENTS.NOTIFICATION,
//         title: 'New Chat Created',
//         body: 'A private chat has been created with you'
//       });

//     }

//     return sendResponse(res, HttpsStatus.CREATED, true, 'Private chat created successfully!', chatPayload);

//   } catch (err) {

//     if (!t.finished) await t.rollback();

//     return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
//   }
// };

// exports.createGroup = async (req, res) => {

//   const t = await sequelize.transaction();

//   try {

//     const { group_name, group_members } = req.body;
//     const currentUserId = req.user.id;
//     const org_id = req.org_id;
//     const io = req.app.get('io');

//     const errors = {};

//     if (!group_name) errors.group_name = 'Group name is required';

//     if (!Array.isArray(group_members)) {
//       errors.group_members = 'Group members must be array';
//     }

//     if (group_members?.length < 2) {
//       errors.group_members = 'At least 2 members required';
//     }

//     if (Object.keys(errors).length > 0) {
//       await t.rollback();
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Validation failed!', null, errors);
//     }

//     const allUserIds = [...group_members, currentUserId];
//     const uniqueUserIds = [...new Set(allUserIds)];

//     const users = await User.findAll({
//       where: {
//         id: uniqueUserIds,
//         is_deleted: false,

//         [Op.or]: [
//           { organization_id: org_id },
//           { org_2: org_id },
//           { org_3: org_id },
//           { org_4: org_id },
//           { org_5: org_id },
//           { org_6: org_id },
//           { org_7: org_id },
//           { org_8: org_id },
//           { org_9: org_id },
//           { org_10: org_id }
//         ]
//       },
//       attributes: ['id']
//     });

//     if (users.length !== uniqueUserIds.length) {
//       await t.rollback();
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         'Some users are not in your organization or are deleted!'
//       );
//     }

//     const chat = await Chat.create({
//       type: 'group',
//       group_name,
//       created_by: currentUserId,
//       organization_id: org_id
//     }, { transaction: t });

//     const members = group_members.map(uid => ({
//       chat_id: chat.id,
//       user_id: uid,
//       role: 'member'
//     }));

//     members.push({
//       chat_id: chat.id,
//       user_id: currentUserId,
//       role: 'admin'
//     });

//     await ChatMember.bulkCreate(members, { transaction: t });

//     await t.commit();

//     const allMembers = [...group_members, currentUserId];

//     const payload = {
//       id: chat.id,
//       type: 'group',
//       group_name,
//       created_by: currentUserId,
//       members: allMembers,
//       created_at: chat.createdAt,
//       last_message: null,
//       unread_count: 0
//     };

//     for (const uid of allMembers) {

//       io.to(`user_${uid}`).emit(EVENTS.CHAT_CREATED, payload);

//       io.to(`user_${uid}`).emit(EVENTS.CHAT_LIST_UPDATE, {
//         action: 'new_chat',
//         data: payload
//       });

//       if (uid === currentUserId) continue;

//       await notifyUser(io, {
//         recipient_id: uid,
//         sender_id: currentUserId,
//         chat_id: chat.id,
//         type: 'group',
//         event: EVENTS.NOTIFICATION,
//         title: 'Added to Group',
//         body: `You were added to ${group_name}`
//       });

//     }

//     return sendResponse(res, HttpsStatus.CREATED, true, 'Group chat created successfully!', payload);

//   } catch (err) {

//     if (!t.finished) await t.rollback();

//     return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
//   }
// };

// exports.groupDetails = async (req, res) => {
//   try {
//     const { chat_id } = req.params;
//     const user_id = req.user.id;
//     const org_id = req.org_id;

//     if (!chat_id) {
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         "Chat id is required"
//       );
//     }

//     /**
//      * 1️⃣ Validate group belongs to organization
//      */
//     const group = await Chat.findOne({
//       where: {
//         id: chat_id,
//         type: "group",
//         organization_id: org_id,
//         is_deleted: false
//       },

//       attributes: [
//         "id",
//         "group_name",
//         "group_image",
//         "created_by",
//         ["created_at", "createdAt"]
//       ],

//       include: [
//         {
//           model: ChatMember,
//           as: "memberships",
//           attributes: ["role", "joined_at", "muted"],

//           include: [
//             {
//               model: User,
//               as: "user",
//               where: {
//                 is_deleted: false,
//                 [Op.or]: [
//                   { organization_id: org_id },
//                   { org_2: org_id },
//                   { org_3: org_id },
//                   { org_4: org_id },
//                   { org_5: org_id },
//                   { org_6: org_id },
//                   { org_7: org_id },
//                   { org_8: org_id },
//                   { org_9: org_id },
//                   { org_10: org_id }
//                 ]
//               },
//               required: false,
//               attributes: [
//                 "id",
//                 "full_name",
//                 "designation",
//                 "position",
//                 "is_online",
//                 "last_seen"
//               ],

//               include: [
//                 {
//                   model: SharedFile,
//                   as: "uploadedFiles",
//                   attributes: ["file_url"],
//                   required: false,
//                   // where: { file_type: "image" }
//                 }
//               ]
//             }
//           ]
//         },

//         {
//           model: SharedFile,
//           as: "files",
//           attributes: [
//             "id",
//             "file_name",
//             "file_url",
//             "file_type",
//             "created_at"
//           ],

//           include: [
//             {
//               model: User,
//               as: "uploader",
//               where: {
//                 is_deleted: false,
//                 [Op.or]: [
//                   { organization_id: org_id },
//                   { org_2: org_id },
//                   { org_3: org_id },
//                   { org_4: org_id },
//                   { org_5: org_id },
//                   { org_6: org_id },
//                   { org_7: org_id },
//                   { org_8: org_id },
//                   { org_9: org_id },
//                   { org_10: org_id }
//                 ]
//               },
//               required: false,
//               attributes: ["id", "full_name"],

//               include: [
//                 {
//                   model: SharedFile,
//                   as: "uploadedFiles",
//                   attributes: ["file_url"],
//                   required: false,
//                   // where: { file_type: "image" }
//                 }
//               ]
//             }
//           ]
//         }
//       ]
//     });

//     if (!group) {
//       return sendResponse(
//         res,
//         HttpsStatus.NOT_FOUND,
//         false,
//         "Group not found"
//       );
//     }

//     /**
//      * 2️⃣ Check membership
//      */
//     const isMember = await ChatMember.findOne({
//       where: {
//         chat_id,
//         user_id
//       }
//     });

//     if (!isMember) {
//       return sendResponse(
//         res,
//         HttpsStatus.FORBIDDEN,
//         false,
//         "You are not a member of this group"
//       );
//     }

//     /**
//      * 3️⃣ Normalize response
//      */

//     const memberships = group.memberships || [];
//     const sharedFiles = group.files || [];

//     const response = {
//       group_id: group.id,
//       group_name: group.group_name,
//       group_image: group.group_image,
//       created_at: group.createdAt,
//       created_by: group.created_by,
//       total_members: memberships.length,

//       members: memberships.filter(m => m.user).map(m => ({
//         id: m.user?.id,
//         name: m.user?.full_name,
//         designation: m.user?.designation,
//         position: m.user?.position,
//         profile_url: m.user?.uploadedFiles?.[0]?.file_url || null,
//         role: m.role,
//         joined_at: m.joined_at,
//         muted: m.muted,
//         is_online: m.user?.is_online,
//         last_seen: m.user?.last_seen
//       })),

//       profile_image : sharedFiles.map(f => ({
//         id: f.id,
//         file_name: f.file_name,
//         file_url: f.file_url,
//         file_type: f.file_type,
//         created_at: f.created_at,

//         uploaded_by: {
//           id: f.uploader?.id,
//           name: f.uploader?.full_name,
//           profile_url:
//             f.uploader?.uploadedFiles?.[0]?.file_url
//         }
//       }))
//     };

//     return sendResponse(
//       res,
//       HttpsStatus.OK,
//       true,
//       "Group details fetched successfully",
//       response
//     );

//   } catch (err) {

//     console.error("groupDetails error:", err);

//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       "Server error!",
//       null,
//       { server: err.message }
//     );
//   }
// };

// exports.addGroupMember = async (req, res) => {

//   try {

//     const { chat_id, user_id } = req.body;
//     const currentUserId = req.user.id;
//     const org_id = req.org_id;

//     if (!chat_id || !user_id) {
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'chat id and user id required');
//     }

//     const chat = await Chat.findOne({
//       where: { id: chat_id, organization_id: org_id, is_deleted: false }
//     });

//     if (!chat) {
//       return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Invalid organization chat');
//     }

//     const admin = await ChatMember.findOne({
//       where: { chat_id, user_id: currentUserId, role: 'admin' }
//     });

//     if (!admin) {
//       return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Only admin can add users');
//     }

//     const user = await User.findOne({
//       where: {
//         id: user_id,
//         is_deleted: false,

//         [Op.or]: [
//           { organization_id: org_id },
//           { org_2: org_id },
//           { org_3: org_id },
//           { org_4: org_id },
//           { org_5: org_id },
//           { org_6: org_id },
//           { org_7: org_id },
//           { org_8: org_id },
//           { org_9: org_id },
//           { org_10: org_id }
//         ]
//       }
//     });

//     if (!user) {
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User not in your organization or deleted');
//     }

//     if (user_id === currentUserId) {
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'You are already part of this group');
//     }

//     const exists = await ChatMember.findOne({
//       where: { chat_id, user_id }
//     });

//     if (exists) {
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User already in group!');
//     }

//     const member = await ChatMember.create({
//       chat_id,
//       user_id,
//       role: 'member'
//     });

//     return sendResponse(res, HttpsStatus.CREATED, true, 'User added!', member);

//   } catch (err) {

//     if (err.name === 'SequelizeUniqueConstraintError') {
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User already in group!');
//     }

//     return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
//   }
// };

// exports.removeGroupMember = async (req, res) => {

//   try {

//     const { chat_id, user_id } = req.body;
//     const currentUserId = req.user.id;
//     const org_id = req.org_id;

//     if (!chat_id || !user_id) {
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'chat_id and user_id required');
//     }

//     const chat = await Chat.findOne({
//       where: { id: chat_id, organization_id: org_id, is_deleted: false }
//     });

//     if (!chat) {
//       return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Invalid organization chat');
//     }

//     const admin = await ChatMember.findOne({
//       where: { chat_id, user_id: currentUserId, role: 'admin' }
//     });

//     if (!admin) {
//       return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Only admin can remove users');
//     }

//     if (user_id === currentUserId) {
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Admin cannot remove themselves');
//     }

//     const member = await ChatMember.findOne({
//       where: { chat_id, user_id }
//     });

//     if (!member) {
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User is not part of this group');
//     }

//     const removed = await ChatMember.destroy({
//       where: { chat_id, user_id }
//     });

//     return sendResponse(res, HttpsStatus.OK, true, 'User removed!', removed);

//   } catch (err) {

//     return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
//   }
// };

// exports.openChat = async (req, res) => {

//   try {

//     const { chat_id } = req.params;
//     const user_id = req.user.id;
//     const org_id = req.org_id;

//     if (!chat_id) {
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Chat id required!');
//     }

//     const chat = await Chat.findOne({
//       where: {
//         id: chat_id,
//         organization_id: org_id,
//         is_deleted: false
//       }
//     });

//     if (!chat) {
//       return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Invalid chat!');
//     }

//     const membership = await ChatMember.findOne({
//       where: { chat_id, user_id }
//     });

//     if (!membership) {
//       return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Not authorized!');
//     }

//     // const messages = await Message.findAll({
//     //   where: { chat_id, is_deleted: false },
//     //   order: [['created_at', 'ASC']]
//     // });

//     const messages = await Message.findAll({
//       where: {
//         chat_id,
//         is_deleted: false
//       },

//       include: [
//         {
//           model: User,
//           as: 'sender',

//           // ✅ multi-org + is_deleted validation
//           where: {
//             is_deleted: false,
//             [Op.or]: [
//               { organization_id: org_id },
//               { org_2: org_id },
//               { org_3: org_id },
//               { org_4: org_id },
//               { org_5: org_id },
//               { org_6: org_id },
//               { org_7: org_id },
//               { org_8: org_id },
//               { org_9: org_id },
//               { org_10: org_id }
//             ]
//           },

//           required: false,

//           attributes: ['id', 'full_name'],

//           include: [
//             {
//               model: SharedFile,
//               as: 'uploadedFiles',
//               attributes: ['file_url'],
//               required: false
//             }
//           ]
//         },

//         {
//           model: SharedFile,
//           as: 'files',
//           required: false
//         },

//         {
//           model: MessageStatus,
//           as: 'statuses',
//           where: {
//             user_id,
//             is_deleted: false
//           },
//           required: false
//         }
//       ],

//       order: [['created_at', 'ASC']]
//     });

//     const formattedMessages = messages.map(msg => {

//       const isYou = msg.sender_id === user_id;

//       return {
//         id: msg.id,
//         chat_id: msg.chat_id,
//         content: msg.content,
//         message_type: msg.message_type,
//         created_at: msg.createdAt,

//         sender_id: msg.sender_id,
//         is_you: isYou,

//         sender: {
//           id: msg.sender?.id,
//           full_name: msg.sender?.full_name,
//           profile_url: msg.sender?.uploadedFiles?.[0]?.file_url || null
//         },

//         status: msg.statuses?.[0]?.status || 'sent',

//         files: msg.files?.map(file => ({
//           id: file.id,
//           file_name: file.file_name,
//           file_url: file.file_url,
//           file_type: file.file_type,
//           mime_type: file.mime_type,
//           file_size: file.file_size,
//           thumbnail_url: file.thumbnail_url,
//           duration: file.duration
//         })) || []
//       };

//     });

//     return sendResponse(res, HttpsStatus.OK, true, 'Messages retrieved!', formattedMessages);

//   } catch (err) {

//     return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
//   }
// };

// exports.chatList = async (req, res) => {
//   try {
//     const user_id = req.user.id;
//     const org_id = req.org_id;

//     /**
//      * 1️⃣ Get chats where user is member
//      */
//     // const chatMembers = await ChatMember.findAll({
//     //   where: { user_id },
//     //   attributes: ['chat_id'],
//     //   include: [
//     //     {
//     //       model: Chat,
//     //       as: 'chat',
//     //       attributes: ['id', 'type', 'group_name', 'created_at'],
//     //       include: [
//     //         {
//     //           model: ChatMember,
//     //           as: 'memberships',
//     //           attributes: ['user_id'],
//     //           include: [
//     //             {
//     //               model: User,
//     //               as: 'user',
//     //               attributes: ['id', 'full_name', 'profile_url', 'is_online']
//     //             }
//     //           ]
//     //         }
//     //       ]
//     //     }
//     //   ]
//     // });
//     const chatMembers = await ChatMember.findAll({
//       where: { user_id },
//       attributes: ['chat_id'],

//       include: [
//         {
//           model: Chat,
//           as: 'chat',
//           where: {
//             organization_id: org_id,
//             is_deleted: false
//           },
//           attributes: ['id', 'type', 'group_name', 'created_at'],

//           include: [
//             {
//               model: ChatMember,
//               as: 'memberships',
//               attributes: ['user_id'],

//               include: [
//                 {
//                   model: User,
//                   as: 'user',
//                   where: {
//                     is_deleted: false,
//                     [Op.or]: [
//                       { organization_id: org_id },
//                       { org_2: org_id },
//                       { org_3: org_id },
//                       { org_4: org_id },
//                       { org_5: org_id },
//                       { org_6: org_id },
//                       { org_7: org_id },
//                       { org_8: org_id },
//                       { org_9: org_id },
//                       { org_10: org_id }
//                     ]
//                   },
//                   required: false,
//                   attributes: [
//                     'id',
//                     'full_name',
//                     'is_online',
//                   ],

//                   include: [
//                     {
//                       model: SharedFile,
//                       as: 'uploadedFiles',
//                       attributes: [],
//                       required: false,
//                       // where: { file_type: 'image' }
//                     }
//                   ]
//                 }
//               ]
//             }
//           ]
//         }
//       ]
//     });

//     if (!chatMembers.length) {
//       return sendResponse(res, HttpsStatus.OK, true, 'Chat list retrieved!', []);
//     }

//     const chatIds = chatMembers.map(cm => cm.chat_id);

//     /**
//      * 2️⃣ Fetch last message per chat
//      */
//     const lastMessages = await Message.findAll({
//       where: {
//         chat_id: { [Op.in]: chatIds },
//         is_deleted: false
//       },
//       attributes: [
//         'chat_id',
//         'content',
//         'message_type',
//         'sender_id',
//         'created_at'
//       ],
//       include: [
//         {
//           model: User,
//           as: 'sender',
//           where: {
//             is_deleted: false,
//             [Op.or]: [
//               { organization_id: org_id },
//               { org_2: org_id },
//               { org_3: org_id },
//               { org_4: org_id },
//               { org_5: org_id },
//               { org_6: org_id },
//               { org_7: org_id },
//               { org_8: org_id },
//               { org_9: org_id },
//               { org_10: org_id }
//             ]
//           },
//           required: false,
//           attributes: ['id', 'full_name']
//         }
//       ],
//       order: [['created_at', 'DESC']]
//     });

//     const lastMessageMap = {};
//     for (const msg of lastMessages) {
//       if (!lastMessageMap[msg.chat_id]) {
//         lastMessageMap[msg.chat_id] = msg;
//       }
//     }

//     /**
//      * 3️⃣ Unread count per chat
//      */
//     const unreadCounts = await MessageStatus.findAll({
//       where: {
//         user_id,
//         status: { [Op.ne]: 'read' }
//       },
//       include: [
//         {
//           model: Message,
//           as: 'message',
//           attributes: ['chat_id'],
//           where: {
//             chat_id: { [Op.in]: chatIds },
//             sender_id: { [Op.ne]: user_id },
//             is_deleted: false
//           }
//         }
//       ]
//     });

//     const unreadMap = {};
//     for (const row of unreadCounts) {
//       const chatId = row.message.chat_id;
//       unreadMap[chatId] = (unreadMap[chatId] || 0) + 1;
//     }

//     /**
//      * 4️⃣ Build final response
//      */
//     const chatList = chatMembers.map(cm => {
//       const chat = cm.chat;
//       if (!chat) return null;
//       const lastMessage = lastMessageMap[chat.id] || null;
      
//       let name = null;
//       let profile_url = null;
//       let is_online = false;

//       if (chat.type === 'private') {
//         // ✅ get other user
//         const otherUser = chat.memberships
//           .map(m => m.user)
//           .find(u => u.id !== user_id);

//         name = otherUser?.full_name || null;
//         // profile_url = otherUser?.profile_url || null;
//         profile_url = otherUser?.uploadedFiles?.[0]?.file_url || null;

//         is_online =otherUser?.is_online || false;
//       } else {
//         // ✅ group chat
//         name = chat.group_name;
//         profile_url = null; // frontend default image
//       }

//       // console.log("lastMessage- ", lastMessage)
//       const last_message = lastMessage
//         ? {
//             content: lastMessage.content,
//             message_type: lastMessage.message_type,
//             created_at: lastMessage?.dataValues?.created_at,
//             sender_name:
//               lastMessage.sender_id === user_id
//                 ? 'You'
//                 : lastMessage.sender?.full_name || null
//           }
//         : null;

//       return {
//         chat_id: chat.id,
//         type: chat.type,
//         name,
//         profile_url,
//         is_online,
//         last_message,
//         unread_count: unreadMap[chat.id] || 0
//       };
//     }).filter(Boolean);
//     // }).filter(Boolean);

//     /**
//      * 5️⃣ Sort by last message time
//      */
//     chatList.sort((a, b) => {
//       const t1 = a.last_message?.created_at || 0;
//       const t2 = b.last_message?.created_at || 0;
//       return new Date(t2) - new Date(t1);
//     });

//     return sendResponse(
//       res,
//       HttpsStatus.OK,
//       true,
//       'Chat list retrieved!',
//       chatList
//     );

//   } catch (err) {
//     console.error('fetchChatList error:', err);
//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       'Server error!',
//       null,
//       { server: err.message }
//     );
//   }
// };

// exports.allPrivateChats = async (req, res) => {
//   try {

//     const user_id = req.user.id;
//     const org_id = req.org_id;

//     if (!user_id) {
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         'User id is required!'
//       );
//     }

//     /**
//      * 1️⃣ Get private chats where user is member
//      */

//     const chatMembers = await ChatMember.findAll({
//       where: { user_id },

//       attributes: ['chat_id'],

//       include: [
//         {
//           model: Chat,
//           as: 'chat',

//           where: {
//             type: 'private',
//             organization_id: org_id,
//             is_deleted: false
//           },

//           attributes: ['id', 'type', 'group_name', 'created_at'],

//           include: [
//             {
//               model: ChatMember,
//               as: 'memberships',

//               attributes: ['user_id'],

//               include: [
//                 {
//                   model: User,
//                   as: 'user',
//                   where: {
//                     is_deleted: false,
//                     [Op.or]: [
//                       { organization_id: org_id },
//                       { org_2: org_id },
//                       { org_3: org_id },
//                       { org_4: org_id },
//                       { org_5: org_id },
//                       { org_6: org_id },
//                       { org_7: org_id },
//                       { org_8: org_id },
//                       { org_9: org_id },
//                       { org_10: org_id }
//                     ]
//                   },
//                   required: false,
//                   attributes: ['id', 'full_name', 'is_online'],

//                   include: [
//                     {
//                       model: SharedFile,
//                       as: 'uploadedFiles',
//                       attributes: ['file_url'],
//                       required: false,
//                       // where: { file_type: 'image' }
//                     }
//                   ]
//                 }
//               ]
//             }
//           ]
//         }
//       ]
//     });

//     if (!chatMembers.length) {
//       return sendResponse(
//         res,
//         HttpsStatus.OK,
//         true,
//         'Private chat list retrieved!',
//         []
//       );
//     }

//     const chatIds = chatMembers.map(cm => cm.chat_id);

//     /**
//      * 2️⃣ Last message per chat
//      */

//     const lastMessages = await Message.findAll({
//       where: { chat_id: { [Op.in]: chatIds }, is_deleted: false },

//       attributes: [
//         'chat_id',
//         'content',
//         'message_type',
//         'sender_id',
//         'created_at'
//       ],

//       include: [
//         {
//           model: User,
//           as: 'sender',
//           where: {
//             is_deleted: false,
//             [Op.or]: [
//               { organization_id: org_id },
//               { org_2: org_id },
//               { org_3: org_id },
//               { org_4: org_id },
//               { org_5: org_id },
//               { org_6: org_id },
//               { org_7: org_id },
//               { org_8: org_id },
//               { org_9: org_id },
//               { org_10: org_id }
//             ]
//           },
//           required: false,
//           attributes: ['id', 'full_name']
//         }
//       ],

//       order: [['created_at', 'DESC']]
//     });

//     const lastMessageMap = {};

//     for (const msg of lastMessages) {
//       if (!lastMessageMap[msg.chat_id]) {
//         lastMessageMap[msg.chat_id] = msg;
//       }
//     }

//     /**
//      * 3️⃣ Unread message count
//      */

//     const unreadCounts = await MessageStatus.findAll({
//       where: {
//         user_id,
//         status: { [Op.ne]: 'read' }
//       },

//       include: [
//         {
//           model: Message,
//           as: 'message',
//           attributes: ['chat_id'],
//           where: {
//             chat_id: { [Op.in]: chatIds },
//             sender_id: { [Op.ne]: user_id },
//             is_deleted: false
//           }
//         }
//       ]
//     });

//     const unreadMap = {};

//     for (const row of unreadCounts) {
//       const chatId = row.message.chat_id;
//       if (chatId) unreadMap[chatId] = (unreadMap[chatId] || 0) + 1;
//     }

//     /**
//      * 4️⃣ Build response
//      */

//     const privateChats = chatMembers.map(cm => {

//       const chat = cm.chat;
//       if (!chat) return null;
//       const lastMessage = lastMessageMap[chat.id] || null;

//       const otherUser = chat.memberships
//         ?.map(m => m.user)
//         ?.find(u => u?.id !== user_id);

//       const profile_url =
//         otherUser?.uploadedFiles?.[0]?.file_url || null;

//       const last_message = lastMessage
//         ? {
//             content: lastMessage.content,
//             message_type: lastMessage.message_type,
//             created_at: lastMessage.created_at,
//             sender_name:
//               lastMessage.sender_id === user_id
//                 ? 'You'
//                 : lastMessage.sender?.full_name || null
//           }
//         : null;

//       return {
//         chat_id: chat.id,
//         type: chat.type,
//         name: otherUser?.full_name || null,
//         profile_url,
//         is_online: otherUser?.is_online || false,
//         last_message,
//         unread_count: unreadMap[chat.id] || 0
//       };
//     });

//     /**
//      * 5️⃣ Sort chats by latest message
//      */

//     privateChats.sort((a, b) => {
//       const t1 = a.last_message?.created_at || 0;
//       const t2 = b.last_message?.created_at || 0;
//       return new Date(t2) - new Date(t1);
//     });

//     return sendResponse(
//       res,
//       HttpsStatus.OK,
//       true,
//       'Private chat list retrieved!',
//       privateChats
//     );

//   } catch (err) {

//     console.error('fetchPrivateChats error:', err);

//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       'Server error!',
//       null,
//       { server: err.message }
//     );
//   }
// };

// exports.allGroupChats = async (req, res) => {
//   try {

//     const user_id = req.user.id;
//     const org_id = req.org_id;

//     if (!user_id) {
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         'User id is required!'
//       );
//     }

//     /**
//      * 1️⃣ Fetch group chats where user is member
//      */

//     const chatMembers = await ChatMember.findAll({
//       where: { user_id },

//       attributes: ['chat_id'],

//       include: [
//         {
//           model: Chat,
//           as: 'chat',

//           where: {
//             type: 'group',
//             organization_id: org_id,
//             is_deleted: false
//           },

//           attributes: ['id', 'type', 'group_name', 'created_at'],

//           include: [
//             {
//               model: ChatMember,
//               as: 'memberships',
//               attributes: ['user_id'],

//               include: [
//                 {
//                   model: User,
//                   as: 'user',
//                   attributes: ['id', 'full_name', 'is_online'],

//                   include: [
//                     {
//                       model: SharedFile,
//                       as: 'uploadedFiles',
//                       attributes: ['file_url'],
//                       required: false,
//                       // where: { file_type: 'image' }
//                     }
//                   ]
//                 }
//               ]
//             },

//             {
//               model: SharedFile,
//               as: 'files',
//               attributes: ['file_url'],
//               required: false,
//               // where: { file_type: 'group_profile' }
//             }
//           ]
//         }
//       ]
//     });

//     if (!chatMembers.length) {
//       return sendResponse(
//         res,
//         HttpsStatus.OK,
//         true,
//         'Group chat list retrieved!',
//         []
//       );
//     }

//     const chatIds = chatMembers.map(cm => cm.chat_id);

//     /**
//      * 2️⃣ Last message per chat
//      */

//     const lastMessages = await Message.findAll({
//       where: { chat_id: { [Op.in]: chatIds }, is_deleted: false },

//       attributes: [
//         'chat_id',
//         'content',
//         'message_type',
//         'sender_id',
//         'created_at'
//       ],

//       include: [
//         {
//           model: User,
//           as: 'sender',
//           attributes: ['id', 'full_name']
//         }
//       ],

//       order: [['created_at', 'DESC']]
//     });

//     const lastMessageMap = {};

//     for (const msg of lastMessages) {
//       if (!lastMessageMap[msg.chat_id]) {
//         lastMessageMap[msg.chat_id] = msg;
//       }
//     }

//     /**
//      * 3️⃣ Unread counts
//      */

//     const unreadCounts = await MessageStatus.findAll({
//       where: {
//         user_id,
//         status: { [Op.ne]: 'read' }
//       },

//       include: [
//         {
//           model: Message,
//           as: 'message',
//           attributes: ['chat_id'],

//           where: {
//             chat_id: { [Op.in]: chatIds },
//             sender_id: { [Op.ne]: user_id },
//             is_deleted: false
//           }
//         }
//       ]
//     });

//     const unreadMap = {};

//     for (const row of unreadCounts) {
//       const chatId = row.message.chat_id;
//       unreadMap[chatId] = (unreadMap[chatId] || 0) + 1;
//     }

//     /**
//      * 4️⃣ Build response
//      */

//     const groupChats = chatMembers.map(cm => {

//       const chat = cm.chat;
//       const lastMessage = lastMessageMap[chat.id] || null;

//       const groupProfile =
//         chat.files?.[0]?.file_url || null;

//       const last_message = lastMessage
//         ? {
//             content: lastMessage.content,
//             message_type: lastMessage.message_type,
//             created_at: lastMessage.created_at,
//             sender_name:
//               lastMessage.sender_id === user_id
//                 ? 'You'
//                 : lastMessage.sender?.full_name || null
//           }
//         : null;

//       return {
//         chat_id: chat.id,
//         type: chat.type,
//         name: chat.group_name,
//         profile_url: groupProfile,
//         is_online: false,
//         last_message,
//         unread_count: unreadMap[chat.id] || 0
//       };
//     });

//     /**
//      * 5️⃣ Sort chats by latest message
//      */

//     groupChats.sort((a, b) => {
//       const t1 = a.last_message?.created_at || 0;
//       const t2 = b.last_message?.created_at || 0;
//       return new Date(t2) - new Date(t1);
//     });

//     return sendResponse(
//       res,
//       HttpsStatus.OK,
//       true,
//       'Group chat list retrieved!',
//       groupChats
//     );

//   } catch (err) {

//     console.error('fetchGroupChats error:', err);

//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       'Server error!',
//       null,
//       { server: err.message }
//     );
//   }
// };

// exports.chatHistory = async (req, res) => {
//   try {

//     const { chat_id } = req.params;
//     const currentUserId = req.user.id;
//     const org_id = req.org_id;

//     /**
//      * 1️⃣ Validate chat belongs to organization
//      */

//     const chat = await Chat.findOne({
//       where: {
//         id: chat_id,
//         organization_id: org_id,
//         is_deleted: false
//       }
//     });

//     if (!chat) {
//       return sendResponse(
//         res,
//         HttpsStatus.FORBIDDEN,
//         false,
//         "Invalid organization chat!"
//       );
//     }

//     /**
//      * 2️⃣ Check membership
//      */

//     const isMember = await ChatMember.findOne({
//       where: {
//         chat_id,
//         user_id: currentUserId
//       }
//     });

//     if (!isMember) {
//       return sendResponse(
//         res,
//         HttpsStatus.FORBIDDEN,
//         false,
//         "Not authorized!"
//       );
//     }

//     /**
//      * 3️⃣ Fetch messages
//      */

//     const messages = await Message.findAll({
//       where: { chat_id, is_deleted: false },

//       include: [
//         {
//           model: User,
//           as: "sender",
//           attributes: ["id", "full_name"],

//           include: [
//             {
//               model: SharedFile,
//               as: "uploadedFiles",
//               attributes: ["file_url"],
//               required: false,
//               // where: { file_type: "image" }
//             }
//           ]
//         },

//         {
//           model: SharedFile,
//           as: "files",
//           required: false
//         },

//         {
//           model: MessageStatus,
//           as: "statuses",
//           where: { user_id: currentUserId },
//           required: false
//         }
//       ],

//       order: [["created_at", "ASC"]]
//     });

//     /**
//      * 4️⃣ Format messages
//      */

//     const formattedMessages = messages.map(msg => {

//       const isYou = msg.sender_id === currentUserId;

//       return {
//         id: msg.id,
//         chat_id: msg.chat_id,
//         content: msg.content,
//         message_type: msg.message_type,
//         created_at: msg.createdAt,

//         sender_id: msg.sender_id,
//         is_you: isYou,

//         sender: {
//           id: msg.sender?.id,
//           full_name: msg.sender?.full_name,
//           profile_url: msg.sender?.uploadedFiles?.[0]?.file_url || null
//         },

//         status: msg.statuses?.[0]?.status || "sent",

//         files:
//           msg.files?.map(file => ({
//             id: file.id,
//             file_name: file.file_name,
//             file_url: file.file_url,
//             file_type: file.file_type,
//             mime_type: file.mime_type,
//             file_size: file.file_size,
//             thumbnail_url: file.thumbnail_url,
//             duration: file.duration
//           })) || []
//       };

//     });

//     return sendResponse(
//       res,
//       HttpsStatus.OK,
//       true,
//       "Messages retrieved successfully!",
//       formattedMessages
//     );

//   } catch (err) {

//     console.error("Fetch messages error:", err);

//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       "Server error!",
//       null,
//       { server: err.message }
//     );
//   }
// };


exports.createPrivateChat = async (req, res) => {

  const t = await sequelize.transaction();

  try {

    const { user_id } = req.body;
    const currentUserId = req.user.id;
    const org_id = req.org_id;
    const io = req.app.get('io');

    if (!user_id) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User id is required!');
    }

    if (user_id === currentUserId) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'You cannot create a private chat with yourself!');
    }

    /**
     * ✅ Validate user belongs to same organization (FIXED)
     */
    const targetUser = await User.findOne({
      where: {
        id: user_id,
        is_deleted: false,

        [Op.or]: [
          { organization_id: org_id },
          { org_2: org_id },
          { org_3: org_id },
          { org_4: org_id },
          { org_5: org_id },
          { org_6: org_id },
          { org_7: org_id },
          { org_8: org_id },
          { org_9: org_id },
          { org_10: org_id }
        ]
      }
    });

    if (!targetUser) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.NOT_FOUND, false, 'User not found in your organization!');
    }

    /**
     * ✅ Check existing private chat
     */
    const existingChat = await Chat.findOne({
      where: {
        type: 'private',
        organization_id: org_id,
        is_deleted: false
      },

      include: [
        {
          model: ChatMember,
          as: 'memberships',
          where: {
            user_id: { [Op.in]: [user_id, currentUserId] }
          },
          attributes: []
        }
      ],

      group: ['Chat.id'],
      having: sequelize.literal(`COUNT(DISTINCT "memberships"."user_id") = 2`),
      subQuery: false
    });

    if (existingChat) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Private chat already exists!');
    }

    /**
     * ✅ Create chat
     */
    const chat = await Chat.create({
      type: 'private',
      created_by: currentUserId,
      organization_id: org_id
    }, { transaction: t });

    await ChatMember.bulkCreate([
      { chat_id: chat.id, user_id: currentUserId },
      { chat_id: chat.id, user_id }
    ], { transaction: t });

    await t.commit();

    const users = [currentUserId, user_id];

    const chatPayload = {
      id: chat.id,
      type: 'private',
      created_by: currentUserId,
      members: users,
      created_at: chat.createdAt,
      last_message: null,
      unread_count: 0
    };

    /**
     * ✅ Emit events
     */
    for (const uid of users) {

      io.to(`user_${uid}`).emit(EVENTS.CHAT_CREATED, chatPayload);

      io.to(`user_${uid}`).emit(EVENTS.CHAT_LIST_UPDATE, {
        action: 'new_chat',
        data: chatPayload
      });

      if (uid === currentUserId) continue;

      await notifyUser(io, {
        recipient_id: uid,
        sender_id: currentUserId,
        chat_id: chat.id,
        type: 'chat',
        event: EVENTS.NOTIFICATION,
        title: 'New Chat Created',
        body: 'A private chat has been created with you'
      });
    }

    return sendResponse(
      res,
      HttpsStatus.CREATED,
      true,
      'Private chat created successfully!',
      chatPayload
    );

  } catch (err) {

    if (!t.finished) await t.rollback();

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

exports.createGroup = async (req, res) => {

  const t = await sequelize.transaction();

  try {

    const { group_name, group_members } = req.body;
    const currentUserId = req.user.id;
    const org_id = req.org_id;
    const io = req.app.get('io');

    const errors = {};

    // ✅ Basic validations
    if (!group_name) errors.group_name = 'Group name is required';

    if (!Array.isArray(group_members)) {
      errors.group_members = 'Group members must be array';
    } else {

      if (group_members.length < 2) {
        errors.group_members = 'At least 2 members required';
      }

      if (new Set(group_members).size !== group_members.length) {
        errors.group_members = 'Duplicate users not allowed';
      }

      if (group_members.includes(currentUserId)) {
        errors.group_members = 'Do not include yourself in group_members';
      }
    }

    if (Object.keys(errors).length > 0) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Validation failed!', null, errors);
    }

    // ✅ ORGANIZATION VALIDATION (INLINE - NO HELPER)
    const allUserIds = [...group_members, currentUserId];
    const uniqueUserIds = [...new Set(allUserIds)];

    const users = await User.findAll({
      where: {
        id: uniqueUserIds,
        is_deleted: false,

        [Op.or]: [
          { organization_id: org_id },
          { org_2: org_id },
          { org_3: org_id },
          { org_4: org_id },
          { org_5: org_id },
          { org_6: org_id },
          { org_7: org_id },
          { org_8: org_id },
          { org_9: org_id },
          { org_10: org_id }
        ]
      },
      attributes: ['id']
    });

    // ❌ If any user invalid → reject
    if (users.length !== uniqueUserIds.length) {
      await t.rollback();
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        'Some users are not in your organization or are deleted!'
      );
    }

    // ✅ Create chat
    const chat = await Chat.create({
      type: 'group',
      group_name,
      created_by: currentUserId,
      organization_id: org_id
    }, { transaction: t });

    const members = group_members.map(uid => ({
      chat_id: chat.id,
      user_id: uid,
      role: 'member'
    }));

    members.push({
      chat_id: chat.id,
      user_id: currentUserId,
      role: 'admin'
    });

    await ChatMember.bulkCreate(members, { transaction: t });

    await t.commit();

    const allMembers = [...group_members, currentUserId];

    const payload = {
      id: chat.id,
      type: 'group',
      group_name,
      created_by: currentUserId,
      members: allMembers,
      created_at: chat.createdAt,
      last_message: null,
      unread_count: 0
    };

    // ✅ Emit events
    for (const uid of allMembers) {

      io.to(`user_${uid}`).emit(EVENTS.CHAT_CREATED, payload);

      io.to(`user_${uid}`).emit(EVENTS.CHAT_LIST_UPDATE, {
        action: 'new_chat',
        data: payload
      });

      if (uid === currentUserId) continue;

      await notifyUser(io, {
        recipient_id: uid,
        sender_id: currentUserId,
        chat_id: chat.id,
        type: 'group',
        event: EVENTS.NOTIFICATION,
        title: 'Added to Group',
        body: `You were added to ${group_name}`
      });
    }

    return sendResponse(
      res,
      HttpsStatus.CREATED,
      true,
      'Group chat created successfully!',
      payload
    );

  } catch (err) {

    if (!t.finished) await t.rollback();

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

exports.groupDetails = async (req, res) => {
  try {
    const { chat_id } = req.params;
    const user_id = req.user.id;
    const org_id = req.org_id;

    if (!chat_id) {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        "Chat id is required"
      );
    }

    /**
     * 1️⃣ Validate group belongs to organization
     */
    const group = await Chat.findOne({
      where: {
        id: chat_id,
        type: "group",
        organization_id: org_id,
        is_deleted: false
      },

      attributes: [
        "id",
        "group_name",
        "group_image",
        "created_by",
        ["created_at", "createdAt"]
      ],

      include: [
        {
          model: ChatMember,
          as: "memberships",
          attributes: ["role", "joined_at", "muted"],

          include: [
            {
              model: User,
              as: "user",

              // ✅ FIX: multi-org + is_deleted validation
              where: {
                is_deleted: false,
                [Op.or]: [
                  { organization_id: org_id },
                  { org_2: org_id },
                  { org_3: org_id },
                  { org_4: org_id },
                  { org_5: org_id },
                  { org_6: org_id },
                  { org_7: org_id },
                  { org_8: org_id },
                  { org_9: org_id },
                  { org_10: org_id }
                ]
              },

              required: false, // important: don't break group if one user invalid

              attributes: [
                "id",
                "full_name",
                "designation",
                "position",
                "is_online",
                "last_seen"
              ],

              include: [
                {
                  model: SharedFile,
                  as: "uploadedFiles",
                  attributes: ["file_url"],
                  required: false
                }
              ]
            }
          ]
        },

        {
          model: SharedFile,
          as: "files",
          attributes: [
            "id",
            "file_name",
            "file_url",
            "file_type",
            "created_at"
          ],

          include: [
            {
              model: User,
              as: "uploader",

              // ✅ FIX: uploader validation
              where: {
                is_deleted: false,
                [Op.or]: [
                  { organization_id: org_id },
                  { org_2: org_id },
                  { org_3: org_id },
                  { org_4: org_id },
                  { org_5: org_id },
                  { org_6: org_id },
                  { org_7: org_id },
                  { org_8: org_id },
                  { org_9: org_id },
                  { org_10: org_id }
                ]
              },

              required: false,

              attributes: ["id", "full_name"],

              include: [
                {
                  model: SharedFile,
                  as: "uploadedFiles",
                  attributes: ["file_url"],
                  required: false
                }
              ]
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
        "Group not found"
      );
    }

    /**
     * 2️⃣ Check membership
     */
    const isMember = await ChatMember.findOne({
      where: {
        chat_id,
        user_id
      }
    });

    if (!isMember) {
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        "You are not a member of this group"
      );
    }

    /**
     * 3️⃣ Normalize response
     */

    const memberships = group.memberships || [];
    const sharedFiles = group.files || [];

    const response = {
      group_id: group.id,
      group_name: group.group_name,
      group_image: group.group_image,
      created_at: group.createdAt,
      created_by: group.created_by,
      total_members: memberships.length,

      members: memberships
        .filter(m => m.user) // ✅ avoid null users
        .map(m => ({
          id: m.user?.id,
          name: m.user?.full_name,
          designation: m.user?.designation,
          position: m.user?.position,
          profile_url: m.user?.uploadedFiles?.[0]?.file_url || null,
          role: m.role,
          joined_at: m.joined_at,
          muted: m.muted,
          is_online: m.user?.is_online,
          last_seen: m.user?.last_seen
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
          profile_url:
            f.uploader?.uploadedFiles?.[0]?.file_url || null
        }
      }))
    };

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Group details fetched successfully",
      response
    );

  } catch (err) {

    console.error("groupDetails error:", err);

    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      { server: err.message }
    );
  }
};

exports.addGroupMember = async (req, res) => {

  try {

    const { chat_id, user_id } = req.body;
    const currentUserId = req.user.id;
    const org_id = req.org_id;

    if (!chat_id || !user_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'chat_id and user_id required');
    }

    // ✅ Validate chat
    const chat = await Chat.findOne({
      where: {
        id: chat_id,
        organization_id: org_id,
        is_deleted: false
      }
    });

    if (!chat) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Invalid organization chat');
    }

    // ✅ Check admin
    const admin = await ChatMember.findOne({
      where: { chat_id, user_id: currentUserId, role: 'admin' }
    });

    if (!admin) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Only admin can add users');
    }

    // ✅ Validate user (multi-org + is_deleted)
    const user = await User.findOne({
      where: {
        id: user_id,
        is_deleted: false,

        [Op.or]: [
          { organization_id: org_id },
          { org_2: org_id },
          { org_3: org_id },
          { org_4: org_id },
          { org_5: org_id },
          { org_6: org_id },
          { org_7: org_id },
          { org_8: org_id },
          { org_9: org_id },
          { org_10: org_id }
        ]
      }
    });

    if (!user) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User not in your organization or deleted');
    }

    // ❌ Prevent adding self again
    if (user_id === currentUserId) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'You are already part of this group');
    }

    // ❌ Prevent duplicate member
    const exists = await ChatMember.findOne({
      where: { chat_id, user_id }
    });

    if (exists) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User already in group!');
    }

    // ✅ Add member
    const member = await ChatMember.create({
      chat_id,
      user_id,
      role: 'member'
    });

    return sendResponse(res, HttpsStatus.CREATED, true, 'User added!', member);

  } catch (err) {

    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
};

exports.removeGroupMember = async (req, res) => {

  try {

    const { chat_id, user_id } = req.body;
    const currentUserId = req.user.id;
    const org_id = req.org_id;

    if (!chat_id || !user_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'chat_id and user_id required');
    }

    // ✅ Validate chat
    const chat = await Chat.findOne({
      where: {
        id: chat_id,
        organization_id: org_id,
        is_deleted: false
      }
    });

    if (!chat) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Invalid organization chat');
    }

    // ✅ Check admin
    const admin = await ChatMember.findOne({
      where: { chat_id, user_id: currentUserId, role: 'admin' }
    });

    if (!admin) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Only admin can remove users');
    }

    // ❌ Prevent admin removing self (optional but recommended)
    if (user_id === currentUserId) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Admin cannot remove themselves');
    }

    // ✅ Check member exists
    const member = await ChatMember.findOne({
      where: { chat_id, user_id }
    });

    if (!member) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User is not part of this group');
    }

    // ✅ Remove member
    await ChatMember.destroy({
      where: { chat_id, user_id }
    });

    return sendResponse(res, HttpsStatus.OK, true, 'User removed!');

  } catch (err) {

    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
  }
};

exports.openChat = async (req, res) => {

  try {

    const { chat_id } = req.params;
    const user_id = req.user.id;
    const org_id = req.org_id;

    if (!chat_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Chat id required!');
    }

    // ✅ Validate chat
    const chat = await Chat.findOne({
      where: {
        id: chat_id,
        organization_id: org_id,
        is_deleted: false
      }
    });

    if (!chat) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Invalid chat!');
    }

    // ✅ Check membership
    const membership = await ChatMember.findOne({
      where: { chat_id, user_id }
    });

    if (!membership) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Not authorized!');
    }

    // 🔥 ============================
    // 🔥 ADDED: STRICT MEMBER VALIDATION
    // 🔥 ============================

    const members = await ChatMember.findAll({
      where: { chat_id },

      include: [
        {
          model: User,
          as: 'user',

          where: {
            is_deleted: false,
            [Op.or]: [
              { organization_id: org_id },
              { org_2: org_id },
              { org_3: org_id },
              { org_4: org_id },
              { org_5: org_id },
              { org_6: org_id },
              { org_7: org_id },
              { org_8: org_id },
              { org_9: org_id },
              { org_10: org_id }
            ]
          },

          required: false, // 🔥 IMPORTANT (we filter manually)

          attributes: ['id']
        }
      ]
    });

    const validMembers = members
      .map(m => m.user)
      .filter(u => u);

    // 🔥 BLOCK invalid private chat
    if (chat.type === 'private') {
      if (validMembers.length !== 2) {
        return sendResponse(
          res,
          HttpsStatus.FORBIDDEN,
          false,
          'Invalid private chat!'
        );
      }
    }

    // 🔥 BLOCK invalid group chat
    if (chat.type === 'group') {
      if (validMembers.length < 2) {
        return sendResponse(
          res,
          HttpsStatus.FORBIDDEN,
          false,
          'Invalid group chat!'
        );
      }
    }

    // 🔥 ============================
    // 🔥 END VALIDATION
    // 🔥 ============================

    // ✅ Fetch messages with sender + files + status
    const messages = await Message.findAll({
      where: {
        chat_id,
        is_deleted: false
      },

      include: [
        {
          model: User,
          as: 'sender',

          // ✅ multi-org + is_deleted validation
          where: {
            is_deleted: false,
            [Op.or]: [
              { organization_id: org_id },
              { org_2: org_id },
              { org_3: org_id },
              { org_4: org_id },
              { org_5: org_id },
              { org_6: org_id },
              { org_7: org_id },
              { org_8: org_id },
              { org_9: org_id },
              { org_10: org_id }
            ]
          },

          required: true,

          attributes: ['id', 'full_name'],

          include: [
            {
              model: SharedFile,
              as: 'uploadedFiles',
              attributes: ['file_url'],
              required: false
            }
          ]
        },

        {
          model: SharedFile,
          as: 'files',
          required: false
        },

        {
          model: MessageStatus,
          as: 'statuses',
          where: {
            user_id,
            is_deleted: false
          },
          required: false
        }
      ],

      order: [['created_at', 'ASC']]
    });

    // ✅ Format response (consistent with chatHistory)
    const formattedMessages = messages.filter(msg => msg.sender).map(msg => {

      const isYou = msg.sender_id === user_id;

      return {
        id: msg.id,
        chat_id: msg.chat_id,
        content: msg.content,
        message_type: msg.message_type,
        created_at: msg.createdAt,

        sender_id: msg.sender_id,
        is_you: isYou,

        sender: {
          id: msg.sender?.id,
          full_name: msg.sender?.full_name,
          profile_url: msg.sender?.uploadedFiles?.[0]?.file_url || null
        },

        status: msg.statuses?.[0]?.status || 'sent',

        files: msg.files?.map(file => ({
          id: file.id,
          file_name: file.file_name,
          file_url: file.file_url,
          file_type: file.file_type,
          mime_type: file.mime_type,
          file_size: file.file_size,
          thumbnail_url: file.thumbnail_url,
          duration: file.duration
        })) || []
      };

    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      'Messages retrieved!',
      formattedMessages
    );

  } catch (err) {

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

exports.chatList = async (req, res) => {
  try {
    const user_id = req.user.id;
    const org_id = req.org_id;

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
          where: {
            organization_id: org_id,
            is_deleted: false
          },
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

                  // ✅ FIX: multi-org + is_deleted
                  where: {
                    is_deleted: false,
                    [Op.or]: [
                      { organization_id: org_id },
                      { org_2: org_id },
                      { org_3: org_id },
                      { org_4: org_id },
                      { org_5: org_id },
                      { org_6: org_id },
                      { org_7: org_id },
                      { org_8: org_id },
                      { org_9: org_id },
                      { org_10: org_id }
                    ]
                  },

                  required: true,

                  attributes: [
                    'id',
                    'full_name',
                    'is_online'
                  ],

                  include: [
                    {
                      model: SharedFile,
                      as: 'uploadedFiles',
                      attributes: ['file_url'],
                      required: false
                    }
                  ]
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
        chat_id: { [Op.in]: chatIds },
        is_deleted: false
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

          // ✅ FIX: sender validation
          where: {
            is_deleted: false,
            [Op.or]: [
              { organization_id: org_id },
              { org_2: org_id },
              { org_3: org_id },
              { org_4: org_id },
              { org_5: org_id },
              { org_6: org_id },
              { org_7: org_id },
              { org_8: org_id },
              { org_9: org_id },
              { org_10: org_id }
            ]
          },
          required: false,
          attributes: ['id', 'full_name']
        }
      ],

      order: [['created_at', 'DESC']]
    });

    // console.log("****************************************Last message ********************",lastMessages)
    // const lastMessageMap = {};
    // for (const msg of lastMessages) {
    //   if (!lastMessageMap[msg.chat_id]) {
    //     lastMessageMap[msg.chat_id] = msg;
    //   }
    // }

    const lastMessageMap = {};
    for (const msg of lastMessages) {
      if (
        !lastMessageMap[msg.chat_id] ||
        new Date(msg.created_at) > new Date(lastMessageMap[msg.chat_id].created_at)
      ) {
        lastMessageMap[msg.chat_id] = msg;
      }
    }

    /**
     * 3️⃣ Unread count per chat
     */
    const unreadCounts = await MessageStatus.findAll({
      where: {
        user_id,
        status: { [Op.ne]: 'read' },
        is_deleted: false // ✅ FIX
      },

      include: [
        {
          model: Message,
          as: 'message',
          attributes: ['chat_id'],

          where: {
            chat_id: { [Op.in]: chatIds },
            sender_id: { [Op.ne]: user_id },
            is_deleted: false
          }
        }
      ]
    });

    const unreadMap = {};
    for (const row of unreadCounts) {
      const chatId = row.message?.chat_id;
      if (chatId) {
        unreadMap[chatId] = (unreadMap[chatId] || 0) + 1;
      }
    }

    /**
     * 4️⃣ Build final response
     */
    // const chatList = chatMembers.map(cm => {

    //   const chat = cm.chat;
    //   if (!chat) return null;

    //   const lastMessage = lastMessageMap[chat.id] || null;

    //   let name = null;
    //   let profile_url = null;
    //   let is_online = false;

    //   if (chat.type === 'private') {

    //     const otherUser = chat.memberships
    //       ?.map(m => m.user)
    //       ?.find(u => u && u.id !== user_id);

    //     name = otherUser?.full_name || null;
    //     profile_url = otherUser?.uploadedFiles?.[0]?.file_url || null;
    //     is_online = otherUser?.is_online || false;

    //   } else {

    //     name = chat.group_name;
    //     profile_url = null;
    //   }

    //   const last_message = lastMessage
    //     ? {
    //         content: lastMessage.content,
    //         message_type: lastMessage.message_type,
    //         created_at: lastMessage.created_at,
    //         sender_name:
    //           lastMessage.sender_id === user_id
    //             ? 'You'
    //             : lastMessage.sender?.full_name || null
    //       }
    //     : null;

    //   return {
    //     chat_id: chat.id,
    //     type: chat.type,
    //     name,
    //     profile_url,
    //     is_online,
    //     last_message,
    //     unread_count: unreadMap[chat.id] || 0
    //   };

    // }).filter(Boolean); // ✅ remove nulls

    const chatList = chatMembers.map(cm => {

      const chat = cm.chat;
      if (!chat) return null;

      // ❗ Ensure valid memberships exist
      const validMembers = chat.memberships
        ?.map(m => m.user)
        ?.filter(u => u); // only valid users

      // ❌ If no valid members → skip
      // if (!validMembers || validMembers.length === 0) return null;

      let name = null;
      let profile_url = null;
      let is_online = false;

      if (chat.type === 'private') {

        // ❗ Must have exactly 2 valid users in private chat
        // if (validMembers.length < 2) return null;

        const otherUser = validMembers.find(u => u.id !== user_id);

        // ❌ If other user missing → skip chat completely
        // if (!otherUser) return null;

        name = otherUser?.full_name || "Unknown User";
        profile_url = otherUser?.uploadedFiles?.[0]?.file_url || null;
        is_online = otherUser?.is_online || false;

      } else {

        // ❗ Optional: ensure at least 2 valid users in group
        if (validMembers.length < 2) return null;

        name = chat.group_name || "Unnamed Group";
      }
  
      const lastMessage = lastMessageMap[chat.id] || null;
      const last_message = lastMessage
        ? {
            content: lastMessage.content,
            message_type: lastMessage.message_type,
            created_at: lastMessage.dataValues.created_at,
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
        created_at: chat.created_at,
        last_message,
        unread_count: unreadMap[chat.id] || 0
      };

    }).filter(Boolean);
    
    /**
     * 5️⃣ Sort by last message time
     */
    // chatList.sort((a, b) => {
    //   const t1 = a.last_message?.created_at || 0;
    //   const t2 = b.last_message?.created_at || 0;
    //   return new Date(t2) - new Date(t1);
    // });

    chatList.sort((a, b) => {
      const t1 = a.last_message?.created_at
        ? new Date(a.last_message.created_at).getTime()
        : new Date(a.created_at || 0).getTime();

      const t2 = b.last_message?.created_at
        ? new Date(b.last_message.created_at).getTime()
        : new Date(b.created_at || 0).getTime();

      return t2 - t1;
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
    const org_id = req.org_id;

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
          where: {
            type: 'private',
            organization_id: org_id,
            is_deleted: false
          },
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

                  // ✅ FIX
                  where: {
                    is_deleted: false,
                    [Op.or]: [
                      { organization_id: org_id },
                      { org_2: org_id },
                      { org_3: org_id },
                      { org_4: org_id },
                      { org_5: org_id },
                      { org_6: org_id },
                      { org_7: org_id },
                      { org_8: org_id },
                      { org_9: org_id },
                      { org_10: org_id }
                    ]
                  },
                  required: false,

                  attributes: ['id', 'full_name', 'is_online'],

                  include: [
                    {
                      model: SharedFile,
                      as: 'uploadedFiles',
                      attributes: ['file_url'],
                      required: false
                    }
                  ]
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
      where: {
        chat_id: { [Op.in]: chatIds },
        is_deleted: false
      },

      attributes: ['chat_id', 'content', 'message_type', 'sender_id', 'created_at'],

      include: [
        {
          model: User,
          as: 'sender',

          // ✅ FIX
          where: {
            is_deleted: false,
            [Op.or]: [
              { organization_id: org_id },
              { org_2: org_id },
              { org_3: org_id },
              { org_4: org_id },
              { org_5: org_id },
              { org_6: org_id },
              { org_7: org_id },
              { org_8: org_id },
              { org_9: org_id },
              { org_10: org_id }
            ]
          },
          required: false,

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

    const unreadCounts = await MessageStatus.findAll({
      where: {
        user_id,
        status: { [Op.ne]: 'read' },
        is_deleted: false // ✅ FIX
      },

      include: [
        {
          model: Message,
          as: 'message',
          attributes: ['chat_id'],
          where: {
            chat_id: { [Op.in]: chatIds },
            sender_id: { [Op.ne]: user_id },
            is_deleted: false
          }
        }
      ]
    });

    const unreadMap = {};
    for (const row of unreadCounts) {
      const chatId = row.message?.chat_id;
      if (chatId) unreadMap[chatId] = (unreadMap[chatId] || 0) + 1;
    }

    // const privateChats = chatMembers.map(cm => {

    //   const chat = cm.chat;
    //   if (!chat) return null;

    //   const lastMessage = lastMessageMap[chat.id] || null;

    //   const otherUser = chat.memberships
    //     ?.map(m => m.user)
    //     ?.find(u => u && u.id !== user_id);

    //   return {
    //     chat_id: chat.id,
    //     type: chat.type,
    //     name: otherUser?.full_name || null,
    //     profile_url: otherUser?.uploadedFiles?.[0]?.file_url || null,
    //     is_online: otherUser?.is_online || false,

    //     last_message: lastMessage
    //       ? {
    //           content: lastMessage.content,
    //           message_type: lastMessage.message_type,
    //           created_at: lastMessage.created_at,
    //           sender_name:
    //             lastMessage.sender_id === user_id
    //               ? 'You'
    //               : lastMessage.sender?.full_name || null
    //         }
    //       : null,

    //     unread_count: unreadMap[chat.id] || 0
    //   };

    // }).filter(Boolean);

    const privateChats = chatMembers.map(cm => {

      const chat = cm.chat;
      if (!chat) return null;

      // 🔥 ADDED: validate members
      const validUsers = chat.memberships
        ?.map(m => m.user)
        ?.filter(u => u);

      // 🔥 BLOCK invalid private chat
      if (!validUsers || validUsers.length !== 2) {
        return null;
      }

      const lastMessage = lastMessageMap[chat.id] || null;

      const otherUser = validUsers.find(u => u.id !== user_id);

      return {
        chat_id: chat.id,
        type: chat.type,
        name: otherUser?.full_name || null,
        profile_url: otherUser?.uploadedFiles?.[0]?.file_url || null,
        is_online: otherUser?.is_online || false,

        last_message: lastMessage
          ? {
              content: lastMessage.content,
              message_type: lastMessage.message_type,
              created_at: lastMessage.dataValues.created_at,
              sender_name:
                lastMessage.sender_id === user_id
                  ? 'You'
                  : lastMessage.sender?.full_name || null
            }
          : null,

        unread_count: unreadMap[chat.id] || 0
      };

    }).filter(Boolean);

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
    const org_id = req.org_id;

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
          where: {
            type: 'group',
            organization_id: org_id,
            is_deleted: false
          },
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

                  // ✅ FIX
                  where: {
                    is_deleted: false,
                    [Op.or]: [
                      { organization_id: org_id },
                      { org_2: org_id },
                      { org_3: org_id },
                      { org_4: org_id },
                      { org_5: org_id },
                      { org_6: org_id },
                      { org_7: org_id },
                      { org_8: org_id },
                      { org_9: org_id },
                      { org_10: org_id }
                    ]
                  },
                  required: false,

                  attributes: ['id', 'full_name', 'is_online'],

                  include: [
                    {
                      model: SharedFile,
                      as: 'uploadedFiles',
                      attributes: ['file_url'],
                      required: false
                    }
                  ]
                }
              ]
            },

            {
              model: SharedFile,
              as: 'files',
              attributes: ['file_url'],
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
      where: {
        chat_id: { [Op.in]: chatIds },
        is_deleted: false
      },

      attributes: ['chat_id', 'content', 'message_type', 'sender_id', 'created_at'],

      include: [
        {
          model: User,
          as: 'sender',

          // ✅ FIX
          where: {
            is_deleted: false,
            [Op.or]: [
              { organization_id: org_id },
              { org_2: org_id },
              { org_3: org_id },
              { org_4: org_id },
              { org_5: org_id },
              { org_6: org_id },
              { org_7: org_id },
              { org_8: org_id },
              { org_9: org_id },
              { org_10: org_id }
            ]
          },
          required: false,

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

    const unreadCounts = await MessageStatus.findAll({
      where: {
        user_id,
        status: { [Op.ne]: 'read' },
        is_deleted: false
      },

      include: [
        {
          model: Message,
          as: 'message',
          attributes: ['chat_id'],
          where: {
            chat_id: { [Op.in]: chatIds },
            sender_id: { [Op.ne]: user_id },
            is_deleted: false
          }
        }
      ]
    });

    const unreadMap = {};
    for (const row of unreadCounts) {
      const chatId = row.message?.chat_id;
      if (chatId) unreadMap[chatId] = (unreadMap[chatId] || 0) + 1;
    }

    // const groupChats = chatMembers.map(cm => {

    //   const chat = cm.chat;
    //   if (!chat) return null;

    //   const lastMessage = lastMessageMap[chat.id] || null;

    //   return {
    //     chat_id: chat.id,
    //     type: chat.type,
    //     name: chat.group_name,
    //     profile_url: chat.files?.[0]?.file_url || null,
    //     is_online: false,

    //     last_message: lastMessage
    //       ? {
    //           content: lastMessage.content,
    //           message_type: lastMessage.message_type,
    //           created_at: lastMessage.created_at,
    //           sender_name:
    //             lastMessage.sender_id === user_id
    //               ? 'You'
    //               : lastMessage.sender?.full_name || null
    //         }
    //       : null,

    //     unread_count: unreadMap[chat.id] || 0
    //   };

    // }).filter(Boolean);

    const groupChats = chatMembers.map(cm => {

      const chat = cm.chat;
      if (!chat) return null;

      // 🔥 ADDED: validate members
      const validUsers = chat.memberships
        ?.map(m => m.user)
        ?.filter(u => u);

      // 🔥 BLOCK invalid group
      if (!validUsers || validUsers.length < 2) {
        return null;
      }

      const lastMessage = lastMessageMap[chat.id] || null;

      return {
        chat_id: chat.id,
        type: chat.type,
        name: chat.group_name,
        profile_url: chat.files?.[0]?.file_url || null,
        is_online: false,

        last_message: lastMessage
          ? {
              content: lastMessage.content,
              message_type: lastMessage.message_type,
              created_at: lastMessage.dataValues.created_at,
              sender_name:
                lastMessage.sender_id === user_id
                  ? 'You'
                  : lastMessage.sender?.full_name || null
            }
          : null,

        unread_count: unreadMap[chat.id] || 0
      };

    }).filter(Boolean);

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
    const org_id = req.org_id;

    /**
     * 1️⃣ Validate chat belongs to organization
     */
    const chat = await Chat.findOne({
      where: {
        id: chat_id,
        organization_id: org_id,
        is_deleted: false
      }
    });

    if (!chat) {
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        "Invalid organization chat!"
      );
    }

    /**
     * 2️⃣ Check membership
     */
    const isMember = await ChatMember.findOne({
      where: {
        chat_id,
        user_id: currentUserId
      }
    });

    if (!isMember) {
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        "Not authorized!"
      );
    }

    // 🔥 ============================
    // 🔥 ADDED: STRICT MEMBER VALIDATION
    // 🔥 ============================

    const members = await ChatMember.findAll({
      where: { chat_id },

      include: [
        {
          model: User,
          as: 'user',
          where: {
            is_deleted: false,
            [Op.or]: [
              { organization_id: org_id },
              { org_2: org_id },
              { org_3: org_id },
              { org_4: org_id },
              { org_5: org_id },
              { org_6: org_id },
              { org_7: org_id },
              { org_8: org_id },
              { org_9: org_id },
              { org_10: org_id }
            ]
          },
          required: false,
          attributes: ['id']
        }
      ]
    });

    const validMembers = members
      .map(m => m.user)
      .filter(u => u);

    // 🔥 BLOCK invalid private chat
    if (chat.type === 'private') {
      if (validMembers.length !== 2) {
        return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Invalid private chat!');
      }
    }

    // 🔥 BLOCK invalid group chat
    if (chat.type === 'group') {
      if (validMembers.length < 2) {
        return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Invalid group chat!');
      }
    }

    /**
     * 3️⃣ Fetch messages
     */
    const messages = await Message.findAll({
      where: {
        chat_id,
        is_deleted: false
      },

      include: [
        {
          model: User,
          as: "sender",

          // ✅ FIX: multi-org + is_deleted
          where: {
            is_deleted: false,
            [Op.or]: [
              { organization_id: org_id },
              { org_2: org_id },
              { org_3: org_id },
              { org_4: org_id },
              { org_5: org_id },
              { org_6: org_id },
              { org_7: org_id },
              { org_8: org_id },
              { org_9: org_id },
              { org_10: org_id }
            ]
          },

          required: true,

          attributes: ["id", "full_name"],

          include: [
            {
              model: SharedFile,
              as: "uploadedFiles",
              attributes: ["file_url"],
              required: false
            }
          ]
        },

        {
          model: SharedFile,
          as: "files",
          required: false
        },

        {
          model: MessageStatus,
          as: "statuses",

          where: {
            user_id: currentUserId,
            is_deleted: false // ✅ FIX
          },

          required: false
        }
      ],

      order: [["created_at", "ASC"]]
    });

    /**
     * 4️⃣ Format messages
     */
    const formattedMessages = messages.filter(msg => msg.sender).map(msg => {

      const isYou = msg.sender_id === currentUserId;

      return {
        id: msg.id,
        chat_id: msg.chat_id,
        content: msg.content,
        message_type: msg.message_type,
        created_at: msg.createdAt,

        sender_id: msg.sender_id,
        is_you: isYou,

        sender: {
          id: msg.sender?.id,
          full_name: msg.sender?.full_name,
          profile_url: msg.sender?.uploadedFiles?.[0]?.file_url || null
        },

        status: msg.statuses?.[0]?.status || "sent",

        files: msg.files?.map(file => ({
          id: file.id,
          file_name: file.file_name,
          file_url: file.file_url,
          file_type: file.file_type,
          mime_type: file.mime_type,
          file_size: file.file_size,
          thumbnail_url: file.thumbnail_url,
          duration: file.duration
        })) || []
      };

    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Messages retrieved successfully!",
      formattedMessages
    );

  } catch (err) {

    console.error("Fetch messages error:", err);

    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      { server: err.message }
    );
  }
};