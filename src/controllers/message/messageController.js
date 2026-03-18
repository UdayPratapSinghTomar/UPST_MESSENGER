const {
  Chat,
  ChatMember,
  Message,
  MessageStatus,
  MessageMention,
  SharedFile,
  User,
  sequelize,
} = require("../../models");
const { sendResponse, HttpsStatus } = require("../../utils/response");
const { getFileType } = require("../../utils/fileType");
const EVENTS = require("../../utils/socketEvents");
const { notifyUser } = require('../../utils/notificationService');
const { userBelongsToOrg } = require('../../utils/organizationFilter');
const { Op } = require("sequelize");

exports.sendMessage = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const sender_id = req.user.id;
    const {
      chat_id,
      content = "",
      mentioned_user_ids = [] // optional array
    } = req.body;
    
    const org_id = req.org_id;
    const io = req.app.get('io');

    if (!chat_id) {
      await t.rollback();
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        'chat_id is required'
      );
    }

    // 1️⃣ Check chat exists & user is member
    const chat = await Chat.findOne({
      where: {
        id: chat_id,
        organization_id: org_id,
        is_deleted: false
      },
      include: [
        {
          model: ChatMember,
          as: 'memberships',
          attributes: ['user_id']
        }
      ],
      transaction: t
    });

    if (!chat) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.NOT_FOUND, false, 'Chat not found');
    }

    const memberIds = chat.memberships.map(m => m.user_id);

    if (!memberIds.includes(sender_id)) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'Not a chat member');
    }

    /**
     * 3️⃣ Detect message type
     */

    const hasFiles = req.files && req.files.length > 0;
    const hasContent = content && content.trim().length > 0;

    if (!hasFiles && !hasContent) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Message cannot be empty!');
    }

    let message_type = "text";
    if (hasFiles && hasContent) message_type = "mixed";
    else if (hasFiles) message_type = "file";

    // const users = await User.findAll({
    //   where: { id: memberIds },
    //   attributes: [
    //     'id',
    //     'organization_id',
    //     'org_2',
    //     'org_3',
    //     'org_4',
    //     'org_5',
    //     'org_6',
    //     'org_7',
    //     'org_8',
    //     'org_9',
    //     'org_10'
    //   ],
    //   transaction: t
    // });

    // const invalidUsers = users.filter(user => !userBelongsToOrg(user, org_id));

    // if (invalidUsers.length > 0) {
    //   await t.rollback();

    //   return sendResponse(
    //     res,
    //     HttpsStatus.FORBIDDEN,
    //     false,
    //     'Users are not from the same organization'
    //   );
    // }

    // 2️⃣ Create message
    const message = await Message.create(
      {
        chat_id,
        sender_id,
        content: hasContent ? content : null,
        message_type
      },
      { transaction: t }
    );

    // 3️⃣ Create message status for each member
    // const statuses = memberIds.map(user_id => ({
    //   message_id: message.id,
    //   chat_id,
    //   user_id,
    //   status: user_id === sender_id ? 'read' : 'sent'
    // }));

    const statuses = [];

    for (const member_id of memberIds) {

      if (member_id === sender_id) {

        statuses.push({
          message_id: message.id,
          chat_id,
          user_id: member_id,
          status: "read",
          read_at: new Date()
        });

        continue;
      }

      const room = io.sockets.adapter.rooms.get(`user_${member_id}`);
      const isOnline = room && room.size > 0;

      statuses.push({
        message_id: message.id,
        chat_id,
        user_id: member_id,
        status: isOnline ? "delivered" : "sent",
        delivered_at: isOnline ? new Date() : null
      });

    }

    await MessageStatus.bulkCreate(statuses, { transaction: t });

    // 4️⃣ Handle mentions
    if (Array.isArray(mentioned_user_ids) && mentioned_user_ids.length) {
      const mentions = mentioned_user_ids
        .filter(uid => memberIds.includes(uid))
        .map(uid => ({
          message_id: message.id,
          mentioned_user_id: uid
        }));

      if (mentions.length) {
        await MessageMention.bulkCreate(mentions, { transaction: t });
      }
    }

    // 5️⃣ Handle file uploads (if any)
    let files = [];
    if (hasFiles) {
      const filesPayload = req.files.map(file => ({
        message_id: message.id,
        chat_id,
        user_id: sender_id,
        file_name: file.originalname,
        file_url: file.path,
        file_type: file.mimetype.split('/')[0],
        mime_type: file.mimetype,
        file_size: file.size
      }));
      // console.log("files payload -",filesPayload);
      files = await SharedFile.bulkCreate(filesPayload, { transaction: t, returning: true });
    }

    // 6️⃣ Commit DB transaction FIRST
    await t.commit();

    const messagePayload = {
      message_id: message.id,
      chat_id,
      sender_id,
      content: message.content,
      message_type,
      files,
      last_message: content || "Attachment",
      created_at: message.createdAt
    };

    // Emit to chat room
    // io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, messagePayload);
    io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, {
      ...messagePayload,
      statuses
    });
    // console.log(`Emitted new_message to chat_${chat_id}:`, messagePayload);

    // ===========================
    // 🔔 NOTIFICATIONS (AFTER COMMIT)
    // ===========================
    for (const member_id of memberIds) {

      io.to(`user_${member_id}`).emit(
        EVENTS.CHAT_LIST_UPDATE,
        {
          action: "new_message",
          data: messagePayload
        }
      );

    }

    // const sender = await User.findByPk(sender_id);
    const sender = await User.findOne({
      where: {
        id: sender_id,
        is_deleted: false // ✅ CHANGE
      }
    });

    for (const member_id of memberIds) {

      // Update chat list realtime
      // io.to(`user_${member_id}`).emit(EVENTS.CHAT_LIST_UPDATE, {
      //   chat_id,
      //   last_message: content,
      //   sender_id,
      //   created_at: message.createdAt
      // });

      // io.to(`user_${member_id}`).emit(EVENTS.CHAT_LIST_UPDATE, {
      //   action: 'new_message',
      //   data: messagePayload
      // });

      if (member_id === sender_id) continue;

      await notifyUser(io, {
        recipient_id: member_id,
        sender_id,
        chat_id,
        message_id: message.id,
        type: 'message',
        event: EVENTS.NEW_MESSAGE,
        title: chat.type === 'private'
          ? sender.full_name
          : chat.group_name,
        body: content || 'Attachment'
      });
    }

    // 7️⃣ Mention notifications (extra)
    for (const mentionedUserId of mentioned_user_ids || []) {
      if (mentionedUserId === sender_id) continue;

      await notifyUser(io,{
        recipient_id: mentionedUserId,
        sender_id,
        chat_id,
        message_id: message.id,
        type: 'mention',
        event: 'mentioned',
        title: 'You were mentioned',
        body: `${sender.full_name} mentioned you`
      });
    }

    // 8️⃣ Success response
    return sendResponse(
      res,
      HttpsStatus.CREATED,
      true,
      'Message sent successfully',
      messagePayload
    );

  } catch (err) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error('sendMessage error:', err);

    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      'Failed to send message',
      null,
      { server: err.message }
    );
  }
};

exports.editMessage = async (req, res) => {

  const t = await sequelize.transaction();

  try {

    const { message_id } = req.params;
    const { content, removed_file_ids = [] } = req.body;

    const userId = req.user.id;
    const org_id = req.org_id;

    const io = req.app.get("io");

    /**
     * 1️⃣ Fetch message
     */
    const message = await Message.findOne({
      where: {
        id: message_id,
        is_deleted: false
      },
      transaction: t
    });

    if (!message) {
      await t.rollback();
      return sendResponse(
        res,
        HttpsStatus.NOT_FOUND,
        false,
        "Message not found!"
      );
    }

    /**
     * 2️⃣ Validate organization chat
     */
    const chat = await Chat.findOne({
      where: {
        id: message.chat_id,
        organization_id: org_id,
        is_deleted: false
      }
    });

    if (!chat) {
      await t.rollback();
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        "Invalid organization chat!"
      );
    }

    /**
     * 3️⃣ Validate membership
     */
    const membership = await ChatMember.findOne({
      where: {
        chat_id: message.chat_id,
        user_id: userId
      }
    });

    if (!membership) {
      await t.rollback();
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        "Not a chat member!"
      );
    }

    /**
     * 4️⃣ Only sender can edit
     */
    if (message.sender_id !== userId) {
      await t.rollback();
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        "You can only edit your own message!"
      );
    }

    /**
     * 5️⃣ Remove selected files
     */
    if (Array.isArray(removed_file_ids) && removed_file_ids.length) {

      await SharedFile.destroy({
        where: {
          id: removed_file_ids,
          message_id: message.id
        },
        transaction: t
      });

    }

    /**
     * 6️⃣ Add new uploaded files
     */
    if (req.files?.length) {

      const newFiles = req.files.map(file => ({
        message_id: message.id,
        chat_id: message.chat_id,
        user_id: userId,
        file_name: file.originalname,
        file_url: `/uploads/${file.filename}`,
        file_type: file.mimetype.split("/")[0],
        mime_type: file.mimetype,
        file_size: file.size
      }));

      await SharedFile.bulkCreate(newFiles, { transaction: t });

    }

    /**
     * 7️⃣ Update message content
     */
    if (typeof content === "string") {
      message.content = content.trim();
    }

    /**
     * 8️⃣ Determine message type
     */
    const filesCount = await SharedFile.count({
      where: { message_id: message.id },
      transaction: t
    });

    const hasFiles = filesCount > 0;
    const hasContent = message.content && message.content.trim().length > 0;

    if (!hasFiles && !hasContent) {
      await t.rollback();

      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        "Message cannot be empty after edit"
      );
    }

    if (hasFiles && hasContent) message.message_type = "mixed";
    else if (hasFiles) message.message_type = "file";
    else message.message_type = "text";

    /**
     * 9️⃣ Update edit metadata
     */
    message.edited_at = new Date();
    message.edit_count += 1;

    await message.save({ transaction: t });

    await t.commit();

    /**
     * 🔟 Fetch updated files
     */
    const files = await SharedFile.findAll({
      where: { message_id: message.id }
    });

    /**
     * Socket payload
     */
    const payload = {
      message_id: message.id,
      chat_id: message.chat_id,
      sender_id: message.sender_id,
      content: message.content,
      message_type: message.message_type,
      files,
      edited_at: message.edited_at,
      edit_count: message.edit_count
    };

    /**
     * Emit realtime update
     */
    io.to(`chat_${message.chat_id}`).emit(
      EVENTS.MESSAGE_UPDATED,
      payload
    );

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Message updated successfully",
      payload
    );

  } catch (err) {

    if (!t.finished) {
      await t.rollback();
    }

    console.error("editMessage error:", err);

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

exports.deleteMessage = async (req, res) => {
  try {

    const { message_id } = req.params;
    const userId = req.user.id;
    const org_id = req.org_id;

    const io = req.app.get("io");

    /**
     * 1️⃣ Fetch message
     */
    const message = await Message.findOne({
      where: {
        id: message_id,
        is_deleted: false
      }
    });

    if (!message) {
      return sendResponse(
        res,
        HttpsStatus.NOT_FOUND,
        false,
        "Message not found!"
      );
    }

    /**
     * 2️⃣ Validate chat belongs to org
     */
    const chat = await Chat.findOne({
      where: {
        id: message.chat_id,
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
     * 3️⃣ Validate membership
     */
    const membership = await ChatMember.findOne({
      where: {
        chat_id: message.chat_id,
        user_id: userId
      }
    });

    if (!membership) {
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        "You are not a member of this chat!"
      );
    }

    /**
     * 4️⃣ Only sender can delete
     */
    if (message.sender_id !== userId) {
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        "You cannot delete this message!"
      );
    }

    /**
     * 5️⃣ Soft delete message
     */
    await Message.update(
      { is_deleted: true },
      { where: { id: message_id } }
    );

    /**
     * 6️⃣ Emit realtime update
     */
    io.to(`chat_${message.chat_id}`).emit(
      EVENTS.MESSAGE_DELETED,
      {
        message_id,
        chat_id: message.chat_id,
        deleted_by: userId
      }
    );

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Message deleted successfully!"
    );

  } catch (err) {

    console.error("deleteMessage error:", err);

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

// exports.deliveredMessage = async (req, res) => {
//   try {
//     const { message_id, chat_id } = req.body;
//     const userId = req.user.id;
//     const io = req.app.get("io");

//     const [updatedCount] = await MessageStatus.update(
//       {
//         status: "delivered",
//         delivered_at: new Date(),
//       },
//       {
//         where: {
//           message_id,
//           user_id: userId,
//           chat_id,
//           status: "sent",
//         },
//       },
//     );

//     if (!updatedCount) {
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         "Message was already delivered or invalid message.",
//       );
//     }

//     io.to(`chat_${chat_id}`).emit("message_status_updated", {
//       message_id,
//       user_id: userId,
//       status: "delivered",
//     });

//     return sendResponse(
//       res,
//       HttpsStatus.OK,
//       true,
//       "Message marked as delivered!",
//       updatedCount,
//     );
//   } catch (err) {
//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       "Server error!",
//       null,
//       { server: err.message },
//     );
//   }
// };

// exports.readMessage = async (req, res) => {
//   try {
//     const { message_id, chat_id } = req.body;
//     const userId = req.user.id;
//     const io = req.app.get("io");

//     const [updatedCount] = await MessageStatus.update(
//       {
//         status: "read",
//         read_at: new Date(),
//       },
//       {
//         where: {
//           message_id,
//           user_id: userId,
//           chat_id,
//           status: { [Op.in]: ["sent", "delivered"] },
//         },
//       },
//     );

//     if (!updatedCount) {
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         "Message was already read or invalid message.",
//       );
//     }

//     io.to(`chat_${chat_id}`).emit("message_status_update", {
//       message_id,
//       user_id: userId,
//       status: "read",
//     });

//     return sendResponse(
//       res,
//       HttpsStatus.OK,
//       true,
//       "Message marked read!",
//       updatedCount,
//     );
//   } catch (err) {
//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       "Server error!",
//       null,
//       { server: err.message },
//     );
//   }
// };

// exports.startTyping = async (req, res) => {
//   try {
//     const { chat_id } = req.body;
//     const userId = req.user.id;
//     const io = req.app.get("io");

//     if (!chat_id) {
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         "Chat id is required!",
//       );
//     }

//     io.to(`chat_${chat_id}`).emit(EVENTS.USER_TYPING, {
//       chat_id,
//       user_id: userId,
//     });

//     return sendResponse(res, HttpsStatus.OK, true, "Typing event sent");
//   } catch (err) {
//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       "Server error!",
//       null,
//       { server: err.message },
//     );
//   }
// };

// exports.stopTyping = async (req, res) => {
//   try {
//     const { chat_id } = req.body;
//     const userId = req.user.id;
//     const io = req.app.get("io");

//     if (!chat_id) {
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         "Chat id is required!",
//       );
//     }

//     io.to(`chat_${chat_id}`).emit(EVENTS.USER_STOP_TYPING, {
//       chat_id,
//       user_id: userId,
//     });

//     return sendResponse(res, HttpsStatus.OK, true, "Stop typing event sent!");
//   } catch (err) {
//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       "Server error!",
//       null,
//       { server: err.message },
//     );
//   }
// };

exports.forwardMessage = async (req, res) => {

  const t = await sequelize.transaction();

  try {

    const { message_id, forwarded_chat_ids } = req.body;
    const senderId = req.user.id;
    const org_id = req.org_id;
    const io = req.app.get("io");

    if (!message_id || !Array.isArray(forwarded_chat_ids) || !forwarded_chat_ids.length) {
      await t.rollback();
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        "Invalid payload!"
      );
    }

    const sender = await User.findOne({
      where: {
        id: senderId,
        is_deleted: false
      },
      attributes: ['id', 'full_name']
    });

    if (!sender) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Invalid user!");
    }

    /**
     * 1️⃣ Fetch original message
     */
    const originalMessage = await Message.findOne({
      where: { 
        id: message_id, 
        is_deleted: false 
      },

      include: [
        {
          model: SharedFile,
          as: "files", // ✅ IMPORTANT FIX

          attributes: [
            "id",
            "file_name",
            "file_url",
            "file_type",
            "mime_type",
            "file_size",
            "duration",
            "thumbnail_url"
          ],

          required: false
        }
      ],

      transaction: t
    });

    if (!originalMessage) {

      await t.rollback();

      return sendResponse(
        res,
        HttpsStatus.NOT_FOUND,
        false,
        "Message not found!"
      );
    }

    const forwardedMessages = [];

    for (const chat_id of forwarded_chat_ids) {

      /**
       * 2️⃣ Validate chat
       */
      const chat = await Chat.findOne({
        where: {
          id: chat_id,
          organization_id: org_id,
          is_deleted: false
        },
        transaction: t
      });

      if (!chat) continue;

      /**
       * 3️⃣ Validate membership
       */
      const isMember = await ChatMember.findOne({
        where: { chat_id, user_id: senderId },
        transaction: t
      });

      if (!isMember) continue;

      /**
       * 4️⃣ Fetch chat members
       */
      const members = await ChatMember.findAll({
        where: { chat_id },
        transaction: t
      });

      /**
       * 5️⃣ Create forwarded message
       */
      const message = await Message.create(
        {
          chat_id,
          sender_id: senderId,
          message_type: originalMessage.message_type,
          content: originalMessage.content,
          forwarded_from_message_id: originalMessage.id,
          forwarded_from_user_id: originalMessage.sender_id,
          forwarded_from_chat_id: originalMessage.chat_id
        },
        { transaction: t }
      );

      /**
       * 6️⃣ Copy files
       */
      let files = [];

      if (originalMessage.SharedFiles?.length) {

        for (const file of originalMessage.SharedFiles) {

          const newFile = await SharedFile.create(
            {
              message_id: message.id,
              chat_id,
              user_id: senderId,
              file_name: file.file_name,
              file_url: file.file_url,
              file_type: file.file_type,
              file_size: file.file_size,
              mime_type: file.mime_type,
              duration: file.duration,
              thumbnail_url: file.thumbnail_url
            },
            { transaction: t }
          );

          files.push(newFile);
        }

      }

      /**
       * 7️⃣ Create message statuses
       */
      await MessageStatus.bulkCreate(
        members.map(m => ({
          message_id: message.id,
          user_id: m.user_id,
          chat_id,
          status: m.user_id === senderId ? "read" : "sent"
        })),
        { transaction: t }
      );

      const payload = {
        message_id: message.id,
        chat_id,
        sender_id: senderId,
        message_type: message.message_type,
        content: message.content,
        files,
        forwarded_from_message_id: originalMessage.id,
        created_at: message.createdAt
      };

      io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, payload);

      forwardedMessages.push(payload);
    }

    if (!forwardedMessages.length) {

      await t.rollback();

      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        "You are not a member of target chats"
      );
    }

    await t.commit();

    return sendResponse(
      res,
      HttpsStatus.CREATED,
      true,
      "Message forwarded successfully!",
      forwardedMessages
    );

  } catch (err) {

    await t.rollback();

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

// exports.mentionUser = async (req, res) => {
//   const t = await sequelize.transaction();

//   try {
//     const { chat_id, content, mentioned_user_ids = [] } = req.body;
//     const senderId = req.user.id;
//     const io = req.app.get("io");

//     if (!chat_id || !content?.trim()) {
//       await t.rollback();
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         "Invalid payload!",
//       );
//     }

//     const isMember = await ChatMember.findOne({
//       where: { chat_id, user_id: senderId },
//     });

//     if (!isMember) {
//       await t.rollback();
//       return sendResponse(
//         res,
//         HttpsStatus.FORBIDDEN,
//         false,
//         "Not a chat member",
//       );
//     }

//     let validMentionedUsers = [];

//     if (Array.isArray(mentioned_user_ids) && mentioned_user_ids.length) {
//       const members = await ChatMember.findAll({
//         where: {
//           chat_id,
//           user_id: mentioned_user_ids,
//         },
//         attributes: ["user_id"],
//         transaction: t,
//       });

//       validMentionedUsers = members
//         .map((m) => m.user_id)
//         .filter((id) => id !== senderId);
//     }

//     const message = await Message.create(
//       {
//         chat_id,
//         sender_id: senderId,
//         message_type: "text",
//         content,
//       },
//       { transaction: t },
//     );

//     const members = await ChatMember.findAll({
//       where: { chat_id },
//       transaction: t,
//     });

//     await MessageStatus.bulkCreate(
//       members.map((m) => ({
//         message_id: message.id,
//         user_id: m.user_id,
//         chat_id,
//         status: "sent",
//       })),
//       { transaction: t },
//     );

//     if (validMentionedUsers.length) {
//       await MessageMention.bulkCreate(
//         validMentionedUsers.map((userId) => ({
//           message_id: message.id,
//           mentioned_user_id: userId,
//         })),
//         { transaction: t },
//       );
//     }

//     await t.commit();

//     const payload = {
//       id: message.id,
//       chat_id,
//       sender_id: senderId,
//       content,
//       mentioned_user_ids: validMentionedUsers,
//       created_at: message.created_at,
//     };

//     io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, payload);

//     validMentionedUsers.forEach((userId) => {
//       io.to(`user_${userId}`).emit(EVENTS.USER_MENTIONED, {
//         chat_id,
//         message_id: message.id,
//         mentioned_by: senderId,
//         content,
//       });
//     });

//     return sendResponse(
//       res,
//       HttpsStatus.CREATED,
//       true,
//       "Message sent with mentions!",
//       payload,
//     );
//   } catch (err) {
//     await t.rollback();
//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       "Server error!",
//       null,
//       { server: err.message },
//     );
//   }
// };