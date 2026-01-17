const {
  User,
  Message,
  MessageStatus,
  Chat,
  ChatMember,
  SharedFile,
} = require("../../models");
const { sendResponse, HttpsStatus } = require("../../utils/response");
const { getFileType } = require('../../utils/fileType');
const EVENTS = require("../../utils/socketEvents");
const { Op, sequelize } = require("sequelize");

exports.sendMessage = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { chat_id, content } = req.body;
    const senderId = req.user.id;
    const io = req.app.get("io");

    if (!chat_id) {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        "Chat id is required"
      );
    }

    const isMember = await ChatMember.findOne({
      where: { chat_id, user_id: senderId },
    });

    if (!isMember) {
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        "Not a chat member"
      );
    }

    const members = await ChatMember.findAll({ where: { chat_id } });

    const hasFiles = Array.isArray(req.files) && req.files.length > 0;
    const hasContent =typeof content === "string" && content.trim().length > 0;

    if(!hasFiles && !hasContent){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Message cannot be empty!');
    }

    let messageType = 'text';
    if(hasFiles && hasContent){
      messageType = 'mixed';
    }
    else if(hasFiles){
      messageType = 'file';
    }

    const message = await Message.create({
      chat_id,
      sender_id: senderId,
      message_type: messageType,
      content: hasContent ? content : null,
    },{
      transaction: t
    });

    let attachedFiles = [];

    if(hasFiles){
      for (const file of req.files){
        const sharedFile = await SharedFile.create({
          message_id: message.id,
          chat_id,
          user_id: senderId,
          file_name: file.originalname,
          file_url: `/uploads/${file.filename}`,
          file_type: getFileType(file.mimetype),
          file_size: file.size,
          mime_type: file.mimetype
        },{
          transaction: t
        });
        attachedFiles.push(sharedFile);
      }
    }

    await MessageStatus.bulkCreate(
      members.map((m) => ({
        message_id: message.id,
        user_id: m.user_id,
        chat_id,
        status: "sent",
      })),
      { transaction: t }
    );

    await t.commit();

    const payload = {
      id: message.id,
      chat_id,
      sender_id: senderId,
      message_type: messageType,
      content: message.content,
      files: attachedFiles,
      created_at: message.created_at,
    };

    io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, payload);

    return sendResponse(res, HttpsStatus.CREATED, true, 'Message created!', payload)
    // const messagesPayload = [];

    // // ❗ TEXT ONLY (no files)
    // if (!req.files || req.files.length === 0) {
    //   const message = await Message.create(
    //     {
    //       chat_id,
    //       sender_id: senderId,
    //       message_type: "text",
    //       content,
    //     },
    //     { transaction: t }
    //   );

    //   await MessageStatus.bulkCreate(
    //     members.map((m) => ({
    //       message_id: message.id,
    //       user_id: m.user_id,
    //       chat_id,
    //       status: "sent",
    //     })),
    //     { transaction: t }
    //   );

    //   const textPayload = {
    //     id: message.id,
    //     chat_id,
    //     sender_id: senderId,
    //     message_type: "text",
    //     content,
    //     file: null,
    //     created_at: message.created_at,
    //   };

    //   io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, textPayload);

    //   await t.commit();
    //   return sendResponse(
    //     res,
    //     HttpsStatus.CREATED,
    //     true,
    //     "Message created!",
    //     textPayload
    //   );
    // }

    // // ❗ FILES PRESENT
    // if (req.files && req.files.length > 0) {
    //   for (const file of req.files) {
    //     let messageType = "file";
    //     if (file.mimetype.startsWith("image")) messageType = "image";
    //     if (file.mimetype.startsWith("video")) messageType = "video";
    //     if (file.mimetype.startsWith("audio")) messageType = "audio";

    //     const message = await Message.create(
    //       {
    //         chat_id,
    //         sender_id: senderId,
    //         message_type: messageType,
    //         content: content || null,
    //       },
    //       { transaction: t }
    //     );

    //     const fileUrl = `/uploads/${file.filename}`;

    //     const sharedFile = await SharedFile.create(
    //       {
    //         message_id: message.id,
    //         chat_id,
    //         user_id: senderId,
    //         file_name: file.originalname,
    //         file_url: fileUrl,
    //         file_type: messageType,
    //         file_size: file.size,
    //         mime_type: file.mimetype,
    //       },
    //       { transaction: t }
    //     );

    //     await MessageStatus.bulkCreate(
    //       members.map((m) => ({
    //         message_id: message.id,
    //         user_id: m.user_id,
    //         chat_id,
    //         status: "sent",
    //       })),
    //       { transaction: t }
    //     );

    //     messagesPayload.push({
    //       id: message.id,
    //       chat_id,
    //       sender_id: senderId,
    //       message_type: messageType,
    //       content: content || null,
    //       file: sharedFile,
    //       created_at: message.created_at,
    //     });
    //   }

    //   io.to(`chat_${chat_id}`).emit(EVENTS.NEW_MESSAGE, messagesPayload);

    //   await t.commit();
    //   return sendResponse(
    //     res,
    //     HttpsStatus.CREATED,
    //     true,
    //     "Messages created!",
    //     messagesPayload
    //   );
    // }
  } catch (err) {
    await t.rollback();
    return sendResponse(res, 500, false, "Server error", null, {
      server: err.message,
    });
  }
};

exports.fetchMessages = async (req, res) => {
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
        created_at: msg.created_at,

        sender_id: msg.sender_id,
        from: isYou ? "you" : msg.sender?.full_name,
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

exports.editMessage = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { message_id } = req.params;
    const {  content, removed_file_ids } = req.body;
    const userId = req.user.id;
    const io = req.app.get('io');

    const message = await Message.findOne({
      where: { id: message_id, is_deleted: false },
      transaction: t
    });

    if(!message){
      return sendResponse(res, HttpsStatus.NOT_FOUND, false, 'Message not found!');
    }

    if(message.sender_id !== userId){
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'You can only edit your own message!');
    }

    const hasNewContent = typeof content === 'string' && content.trim().length > 0;
    const hasRemovedFiles = Array.isArray(removed_file_ids) && removed_file_ids.length > 0;
    const hasNewFiles = Array.isArray(req.files) && req.files.length > 0;

    if(!hasNewContent && !hasRemovedFiles && !hasNewFiles){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Nothing to update!');
    }

    if(hasRemovedFiles){
      await SharedFile.destroy({
        where: {
          id: removed_file_ids,
          message_id: message.id
        },
        transaction: t
      });
    }

    const newlyAddedFiles = [];
    
    if (hasNewFiles) {
      for (const file of req.files) {
        const sharedFile = await SharedFile.create(
          {
            message_id: message.id,
            chat_id: message.chat_id,
            user_id: userId,
            file_name: file.originalname,
            file_url: `/uploads/${file.filename}`,
            file_type: getFileType(file.mimetype),
            file_size: file.size,
            mime_type: file.mimetype,
          },
          { transaction: t }
        );

        newlyAddedFiles.push(sharedFile);
      }
    }

    if(hasNewContent){
      message.content = content;
    }

    const remainingFilesCount = await SharedFile.count({
      where: { message_id: message.id },
      transaction: t
    });

    const hasAnyFiles = remainingFilesCount > 0;
    const hasAnyContent = typeof message.content === 'string' && message.content.trim().length > 0;

    if(!hasAnyFiles && !hasAnyContent){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Message cannot be empty after edit');
    }

    if(hasAnyFiles && hasAnyContent){
      message.message_type = 'mixed';
    }
    else if(hasAnyFiles){
      message.message_type = 'file';
    }
    else{
      message.message_type = 'text';
    }

    message.edited_at = new Date();
    message.edit_count += 1;
    await message.save({ transaction: t });

    await t.commit();

    const updatedFiles = await SharedFile.findAll({
      where: { message_id: message.id },
    });

    const payload = {
      id: message.id,
      chat_id: message.chat_id,
      content: message.content,
      message_type: message.message_type,
      files: updatedFiles,
      edited_at: message.edited_at,
      edit_count: message.edit_count,
    };

    io.to(`chat_${message.chat_id}`).emit(EVENTS.MESSAGE_UPDATED, payload);

    return sendResponse(res, HttpsStatus.OK, true, 'Message updated!', payload);
  } catch (err) {
    await t.rollback();
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
  }
}

exports.deleteMessage = async (req, res, io) => {
  try{
    const userId = req.user.id;
    const { message_id } = req.params;
    const io = req.app.get('io');

    const message = await Message.findByPk(message_id);
    if(!message){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Message not found!');
    }

    if(message.sender_id !== userId){
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'You cannot delete this message!')
    }

    await MessageStatus.update(
      { is_deleted: true },
      { where: { id: message_id } }
    );

    // await Message.update(
    //   { is_deleted: true },
    //   { where: { id: message_id } }
    // );

    io.to(`chat_${message.chat_id}`).emit(EVENTS.MESSAGE_DELETED, {
      message_id,
      user_id: userId
    });

    return sendResponse(res, HttpsStatus.OK, true, 'Message deleted successfull!');
  }catch(err){
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
  }
}

exports.deliveredMessage = async (req, res) => {
  try {
    const { message_id, chat_id } = req.body;
    const userId = req.user.id;
    const io = req.app.get("io");

    const [updatedCount] = await MessageStatus.update(
      {
        status: "delivered",
        delivered_at: new Date(),
      },
      {
        where: {
          message_id,
          user_id: userId,
          chat_id,
          status: "sent",
        },
      }
    );

    if (!updatedCount) {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        "Message was already delivered or invalid message."
      );
    }

    io.to(`chat_${chat_id}`).emit("message_status_updated", {
      message_id,
      user_id: userId,
      status: "delivered",
    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Message marked as delivered!",
      updatedCount
    );
  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      err.message
    );
  }
};

exports.readMessage = async (req, res) => {
  try {
    const { message_id, chat_id } = req.body;
    const userId = req.user.id;
    const io = req.app.get("io");

    const [updatedCount] = await MessageStatus.update(
      {
        status: "read",
        read_at: new Date(),
      },
      {
        where: {
          message_id,
          user_id: userId,
          chat_id,
          status: { [Op.in]: ["sent", "delivered"] },
        },
      }
    );

    if (!updatedCount) {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        "Message was already read or invalid message."
      );
    }
    
    io.to(`chat_${chat_id}`).emit("message_status_update", {
      message_id,
      user_id: userId,
      status: "read",
    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Message marked read!",
      updatedCount
    );
  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      err.message
    );
  }
};

exports.startTyping = async (req, res) => {
  try{
    const { chat_id } = req.body;
    const userId = req.user.id;
    const io = req.app.get('io');

    if(!chat_id){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Chat id is required!');
    }

    io.to(`chat_${chat_id}`).emit(EVENTS.USER_TYPING, {
      chat_id,
      user_id: userId
    });

    return sendResponse(res, HttpsStatus.OK, true, 'Typing event sent');
  }catch(err){
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
  }
}

exports.stopTyping = async (req, res) => {
  try{
    const { chat_id } = req.body;
    const userId = req.user.id;
    const io = req.app.get('io');

    if(!chat_id){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Chat id is required!');
    }

    io.to(`chat_${chat_id}`).emit(EVENTS.USER_STOP_TYPING, {
      chat_id,
      user_id: userId,
    });

    return sendResponse(res, HttpsStatus.OK, true, 'Stop typing event sent!');
  }catch(err){
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
  }
}
