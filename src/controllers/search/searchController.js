const { sequelize, User, Chat, ChatMember, Message,  MessageMention, SharedFile } = require('../../models');
const { Op } = require('sequelize');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const BASE_URL = process.env.BASE_URL;

// exports.searchAll = async (req, res) => {
//   try {

//     const user_id = req.user.id;
//     const org_id = req.org_id;
//     const { search } = req.query;
//     const q = search.trim();

//     if (!q) {
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         "Search bar is empty!",
//         { users: [], groups: [], messages: [], files: [] }
//       );
//     }

//     /**
//      * 1️⃣ USERS + PRIVATE CHAT SEARCH
//      */

//     const usersRaw = await User.findAll({
//       where: {
//         id: { [Op.ne]: user_id },
//         is_deleted: false,

//         // ✅ Group search condition properly
//         [Op.and]: [

//           {
//             // full_name OR email
//             [Op.or]: [
//               { full_name: { [Op.iLike]: `%${q}%` } },
//               { email: { [Op.iLike]: `%${q}%` } }
//             ]
//           },

//           {
//             // organization must match
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
//           }

//         ]
//       },

//       attributes: ["id", "full_name"],

//       include: [
//         {
//           model: SharedFile,
//           as: "uploadedFiles",
//           attributes: ["file_url"],
//           required: false
//         }
//       ]
//     });

//     const users = [];

//     for (const u of usersRaw) {

//       const privateChat = await ChatMember.findOne({
//         attributes: ["chat_id"],

//         where: {
//           user_id: { [Op.in]: [user_id, u.id] }
//         },

//         group: ["chat_id"],

//         having: sequelize.literal(`COUNT(DISTINCT "user_id") = 2`),

//         raw: true
//       });

//       users.push({
//         user_id: u.id,
//         name: u.full_name,
//         profile_image: u.uploadedFiles?.[0]?.file_url ?? null,
//         chat_id: privateChat?.chat_id ?? null,
//         chat_type: "private"
//       });

//     }

//     /**
//      * 2️⃣ GROUP SEARCH
//      */
//     const groupsRaw = await Chat.findAll({
//       where: {
//         type: "group",
//         organization_id: org_id,
//         group_name: { [Op.iLike]: `%${q}%` },
//         is_deleted: false
//       },

//       include: [
//         {
//           model: ChatMember,
//           as: "memberships",
//           where: { user_id },
//           attributes: []
//         },

//         {
//           model: SharedFile,
//           as: "files",
//           attributes: ["file_url"],
//           required: false,
//           // where: { file_type: "image" }
//         }
//       ],

//       attributes: ["id", "group_name"],
//       distinct: true
//     });

//     const groups = groupsRaw.map(g => ({
//       group_id: g.id,
//       group_name: g.group_name,
//       group_image: g.files?.[0]?.file_url ?? null,
//       chat_id: g.id,
//       chat_type: "group"
//     }));


//     /**
//      * 3️⃣ MESSAGE SEARCH
//      */
//     const messagesRaw = await Message.findAll({

//       where: {
//         content: { [Op.iLike]: `%${q}%` }
//       },

//       include: [
//         {
//           model: Chat,
//           as: "chat",
//           attributes: ["id", "type", "group_name"],

//           where: {
//             organization_id: org_id,
//             is_deleted: false
//           },

//           include: [
//             {
//               model: ChatMember,
//               as: "memberships",
//               where: { user_id },
//               attributes: []
//             }
//           ]
//         },

//         {
//           model: User,
//           as: "sender",
//           attributes: ["id", "full_name"]
//         }
//       ],

//       attributes: [
//         "id",
//         "chat_id",
//         "sender_id",
//         "content",
//         "message_type",
//         "created_at"
//       ],

//       order: [["created_at", "DESC"]],
//       distinct: true
//     });

//     const messages = messagesRaw.map(m => ({
//       message_id: m.id,
//       chat_id: m.chat_id,
//       chat_type: m.chat?.type,
//       sender_id: m.sender_id,
//       sender_name: m.sender?.full_name ?? null,
//       message: m.content,
//       message_type: m.message_type,
//       created_at: m.created_at
//     }));


//     /**
//      * 4️⃣ FILE SEARCH
//      */
//     const filesRaw = await SharedFile.findAll({

//       where: {
//         file_name: { [Op.iLike]: `%${q}%` }
//       },

//       include: [
//         {
//           model: Chat,
//           as: "chat",
//           attributes: ["id", "type"],

//           where: {
//             organization_id: org_id,
//             is_deleted: false
//           },

//           include: [
//             {
//               model: ChatMember,
//               as: "memberships",
//               where: { user_id },
//               attributes: []
//             }
//           ]
//         }
//       ],

//       attributes: [
//         "message_id",
//         "chat_id",
//         "file_name",
//         "file_url",
//         "file_type",
//         "user_id",
//         "created_at"
//       ],
//       distinct: true 
//     });

//     const files = filesRaw.map(f => ({
//       message_id: f.message_id,
//       chat_id: f.chat_id,
//       chat_type: f.chat?.type,
//       file_name: f.file_name,
//       file_url: f.file_url,
//       file_type: f.file_type,
//       uploaded_by: f.user_id,
//       created_at: f.created_at
//     }));


//     /**
//      * FINAL RESPONSE
//      */
//     return res.json({
//       status: true,
//       query: q,
//       data: {
//         users,
//         groups,
//         messages,
//         files
//       }
//     });

//   } catch (err) {

//     console.error("searchAll error:", err);

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

exports.searchAll = async (req, res) => {
  try {

    const user_id = req.user.id;
    const org_id = req.org_id;
    const q = req.query.search?.trim();

    if (!q) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Search bar is empty!", { users: [], groups: [], messages: [], files: [] });
    }

    // 🔥 helper
    const orgCondition = {
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
    };

    const getLastMessage = async (chat_id, user_id) => {
      const msg = await Message.findOne({
        where: { chat_id, is_deleted: false },
        order: [['created_at', 'DESC']],
        attributes: [
          'id',
          'content',
          'message_type',
          'sender_id',
          'created_at',
          'edited_at',
          'forwarded_from_message_id'
        ],

        include: [
          {
            model: SharedFile,
            as: "files",
            where: {
              user_id: { [Op.ne]: null },
              message_id: { [Op.ne]: null },
              chat_id: { [Op.ne]: null }
            },
            attributes: ["file_name", "file_url"],
            required: false
          }
        ]
      });

      if (!msg) return null;

      /**
       * 🔥 Handle content (text / file)
       */
      let content = msg.content;

      if (!content && msg.files?.length) {
        content = msg.files[0].file_name || "File";
      }

      return {
        id: msg.id,
        content,
        message_type: msg.message_type,
        sender_id: msg.sender_id,
        created_at: msg.created_at,

        // ✅ NEW FLAG
        is_you: msg.sender_id === user_id,

        // ✅ existing flags
        is_edited: !!msg.edited_at,
        is_forwarded: !!msg.forwarded_from_message_id,

        // ✅ files
        files: msg.files?.map(f => ({
          file_name: f.file_name,
          file_url: f.file_url
        })) || []
      };
    };
    /**
     * 1️⃣ USERS
     */
    const usersRaw = await User.findAll({
      where: {
        id: { [Op.ne]: user_id },
        is_deleted: false,
        [Op.and]: [
          {
            [Op.or]: [
              { full_name: { [Op.iLike]: `%${q}%` } },
              { email: { [Op.iLike]: `%${q}%` } }
            ]
          },
          orgCondition
        ]
      },
      attributes: ["id", "full_name"],
      include: [{
        model: SharedFile,
        as: "uploadedFiles",
        where: {chat_id: null, message_id: null, user_id: { [Op.ne]: null }},
        attributes: ["file_url"],
        required: false
      }]
    });

    const users = await Promise.all(usersRaw.map(async (u) => {

      const chat = await Chat.findOne({
        where: {
          type: "private",
          organization_id: org_id,
          is_deleted: false
        },
        include: [
          {
            model: ChatMember,
            as: "memberships",
            include: [{
              model: User,
              as: "user",
              where: { is_deleted: false, ...orgCondition },
              required: true,
              attributes: []
            }],
            where: {
              user_id: { [Op.in]: [user_id, u.id] }
            },
            attributes: []
          }
        ],
        group: ["Chat.id"],
        having: sequelize.literal(`COUNT(DISTINCT "memberships"."user_id") = 2`),
        subQuery: false
      });
      const last_message = chat ? await getLastMessage(chat.id, user_id) : null;
      return {
        user_id: u.id,
        full_name: u.full_name,
        profile_image: u.uploadedFiles?.[0]?.file_url ? BASE_URL+u.uploadedFiles?.[0]?.file_url : null,
        chat_id: chat?.id ?? null,
        chat_type: "private",
        last_message
      };
    }));

    /**
     * 2️⃣ GROUPS
     */
    const groupsRaw = await Chat.findAll({
      where: {
        type: "group",
        organization_id: org_id,
        group_name: { [Op.iLike]: `%${q}%` },
        is_deleted: false
      },
      include: [
        {
          model: ChatMember,
          as: "memberships",
          required: true,
          where: { user_id },
          include: [{
            model: User,
            as: "user",
            where: { is_deleted: false, ...orgCondition },
            required: false,
            attributes: ["id"]
          }]
        },
        {
          model: SharedFile,
          as: "files",
          where: {message_id: null,
            user_id: { [Op.ne]: null },
            chat_id: { [Op.ne]: null }},
          attributes: ["file_url"],
          required: false
        }
      ]
    });

    const groups = await Promise.all(groupsRaw.map(async (g) => {

      const last_message = await getLastMessage(g.id, user_id);

      return {
        group_id: g.id,
        group_name: g.group_name,
        group_image: g.files?.[0]?.file_url ? BASE_URL + g.files[0].file_url : null,
        chat_id: g.id,
        chat_type: g.type,
        last_message
      };
    }));

    /**
     * 3️⃣ MESSAGES
     */
    const messagesRaw = await Message.findAll({
      subQuery: false,
      where: {
        content: { [Op.iLike]: `%${q}%` },
        is_deleted: false,
      },
      include: [
        {
          model: Chat,
          as: "chat",
          required: true,
          where: {
            organization_id: org_id,
            is_deleted: false
          },
          include: [{
            model: ChatMember,
            as: "memberships",
            attributes: ["user_id"],
            required: false,
            include: [{
              model: User,
              as: "user",
              where: {
                is_deleted: false,
                ...orgCondition
              },
              attributes: ["id", "full_name"],
              required: true
            }]
          }]
        },
        {
          model: User,
          as: "sender",
          where: { is_deleted: false, ...orgCondition },
          required: true,
          attributes: ["id", "full_name"]
        }
      ],
      order: [["created_at", "DESC"]]
    });

//     const messages = messagesRaw
//       .filter(m => m.sender && m.chat)
//       .map(m => {

//         const chat = m.chat;
//         let name = null;
//         console.log('chat',chat)
// console.log(chat.memberships)
//         if(chat.type === "group"){
//           name = chat.group_name || "Unnamed Group";
//         }else{
//           const members = chat.memberships
//             ?.map(mem => mem.user)
//             ?.filter(Boolean);

//           const otherUser = members.find(u => u.id !== user_id);

//           name = otherUser?.full_name || "Unknown User";
//         }
//         return {
//           message_id: m.id,
//           chat_id: m.chat_id,
//           name,
//           chat_type: m.chat?.type,
//           sender_id: m.sender_id,
//           sender_name: m.sender.full_name,
//           message: m.content,
//           message_type: m.message_type,
//           created_at: m.created_at
//         }
//       });

const messages = messagesRaw
  .filter(m => {
    const members = m.chat?.memberships || [];

    // ✅ Ensure logged-in user is part of chat
    return members.some(mem => mem.user_id === user_id);
  })
  .map(m => {

    const chat = m.chat;
    let name = null;

    /**
     * 🔹 GROUP
     */
    if (chat.type === "group") {

      name = chat.group_name || "Unnamed Group";

    /**
     * 🔹 PRIVATE
     */
    } else {

      const members = chat.memberships
        ?.map(mem => mem.user)
        ?.filter(Boolean);

      const otherUser = members.find(u => u.id !== user_id);

      name = otherUser?.full_name || "Unknown User";
    }

    return {
      message_id: m.id,
      chat_id: m.chat_id,
      name,
      chat_type: chat.type,
      sender_id: m.sender_id,
      sender_name: m.sender.full_name,
      is_you: m.sender_id === user_id,
      message: m.content,
      message_type: m.message_type,
      created_at: m.created_at
    };
  });
    /**
     * 4️⃣ FILES
     */
    const filesRaw = await SharedFile.findAll({
      where: {
        file_name: { [Op.iLike]: `%${q}%` },
        user_id: { [Op.ne]: null },
        message_id: { [Op.ne]: null },
        chat_id: { [Op.ne]: null }
      },
      include: [
        {
          model: Chat,
          as: "chat",
          where: {
            organization_id: org_id,
            is_deleted: false
          },
          include: [{
            model: ChatMember,
            as: "memberships",
            where: { user_id },
            attributes: []
          }]
        },
        {
          model: User,
          as: "uploader",
          where: { is_deleted: false, ...orgCondition },
          required: true,
          attributes: ["id"]
        }
      ]
    });

    const files = filesRaw.map(f => {
      const chat = f.chat;

      const name = chat.type === "group"
        ? chat.group_name
        : "Private Chat";
      return {
        message_id: f.message_id,
        chat_id: f.chat_id,
        name,
        chat_type: f.chat?.type,
        file_name: f.file_name,
        file_url: f.file_url ? BASE_URL+f.file_url : null,
        file_type: f.file_type,
        uploaded_by: f.user_id,
        is_you: f.user_id === user_id,
        created_at: f.created_at
      }
    });

    return res.json({
      status: true,
      query: q,
      data: { users, groups, messages, files }
    });

  } catch (err) {
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
  }
};

// exports.searchChatMessages = async (req, res) => {
//   try {

//     const { chat_id } = req.params;
//     const { search } = req.query;
//     const q = search.trim();
//     const user_id = req.user.id;
//     const org_id = req.org_id;

//     if (!q) {
//       return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Search query is empty!", []);
//     }

//     /**
//      * Check chat belongs to organization
//      */
//     const chat = await Chat.findOne({
//       where: {
//         id: chat_id,
//         organization_id: org_id,
//         is_deleted: false
//       }
//     });

//     if (!chat) {
//       return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Invalid organization chat");
//     }

//     /**
//      * Check membership
//      */
//     const membership = await ChatMember.findOne({
//       where: { chat_id, user_id }
//     });

//     if (!membership) {
//       return sendResponse(res, HttpsStatus.FORBIDDEN, false, "You are not a member of this chat");
//     }

//     /**
//      * Search messages
//      */
//     const messages = await Message.findAll({
//       where: {
//         chat_id,
//         [Op.or]: [
//           { content: { [Op.iLike]: `%${q}%` } },
//           { "$files.file_name$": { [Op.iLike]: `%${q}%` } } // ✅ key fix
//         ]
//       },

//       include: [
//         {
//           model: SharedFile,
//           as: "files",
//           attributes: ["file_name", "file_url"],
//           required: false,
//           // where: {
//           //   file_name: { [Op.iLike]: `%${q}%` }
//           // }
//         },

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
//         }
//       ],

//       attributes: ["id", "chat_id", "sender_id", "content", "created_at"],
//       order: [["created_at", "DESC"]],
//       distinct: true,
//       subQuery: false
//     });

//     return sendResponse(
//       res,
//       HttpsStatus.OK,
//       true,
//       "Chat messages retrieved successfully!",
//       messages
//     );

//   } catch (err) {

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

exports.searchChatMessages = async (req, res) => {
  try {

    const { chat_id } = req.params;
    const q = req.query.search?.trim();
    const user_id = req.user.id;
    const org_id = req.org_id;

    if (!q) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Search query is empty!", []);
    }

    const orgCondition = {
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
    };

    // ✅ Chat validation
    const chat = await Chat.findOne({
      where: {
        id: chat_id,
        organization_id: org_id,
        is_deleted: false
      }
    });

    if (!chat) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Invalid chat");
    }

    // ✅ Membership
    const membership = await ChatMember.findOne({
      where: { chat_id, user_id }
    });

    if (!membership) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Not authorized");
    }

    // ✅ Member validation
    const members = await ChatMember.findAll({
      where: { chat_id },
      include: [{
        model: User,
        as: "user",
        where: { is_deleted: false, ...orgCondition },
        required: false,
        attributes: ["id"]
      }]
    });

    const validMembers = members.map(m => m.user).filter(Boolean);

    if (chat.type === "private" && validMembers.length !== 2) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Invalid private chat");
    }

    if (chat.type === "group" && validMembers.length < 2) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Invalid group chat");
    }

    // ✅ SEARCH MESSAGES
    const messages = await Message.findAll({
      where: {
        chat_id,
        is_deleted: false,
        [Op.or]: [
          { content: { [Op.iLike]: `%${q}%` } },
          { "$files.file_name$": { [Op.iLike]: `%${q}%` } }
        ]
      },
      include: [
        {
          model: SharedFile,
          as: "files",
          attributes: ["file_name", "file_url"],
          required: false
        },
        {
          model: User,
          as: "sender",
          where: { is_deleted: false, ...orgCondition },
          required: true,
          attributes: ["id", "full_name"]
        }
      ],
      order: [["created_at", "DESC"]]
    });

    // const mentions = await MessageMention.findAll({
    //   where: { message_id: messages.map(m => m.id) }
    // });

    // const mentionMap = {};
    // mentions.forEach(m => {
    //   if (!mentionMap[m.message_id]) mentionMap[m.message_id] = [];
    //   mentionMap[m.message_id].push(m.mentioned_user_id);
    // });

    const formattedMessages = messages.map(msg => {

      // const mentionIds = mentionMap[msg.id] || [];
      // const isMentioned = mentionIds.includes(user_id);

      return {
        id: msg.id,
        chat_id: msg.chat_id,
        sender_id: msg.sender_id,
        message_type: msg.message_type,
        content: msg.content,

        // ✅ FLAGS
        // is_edited: !!msg.edited_at,
        // is_forwarded: !!msg.forwarded_from_message_id,
        // is_mentioned: isMentioned,
        // mentioned_user_ids: mentionIds,

        // ✅ FILES
        files: msg.files?.map(file => ({
          file_name: file.file_name,
          file_url: file.file_url ? BASE_URL + file.file_url : null
        })) || [],

        // ✅ SENDER
        sender: {
          id: msg.sender.id,
          full_name: msg.sender.full_name
        }
      };

    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Chat messages retrieved!",
      formattedMessages
    );

  } catch (err) {
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

exports.searchUsers = async (req, res) => {
  try {

    const { search } = req.query;
    const q = search.trim();
    const org_id = req.org_id;
    const currentUserId = req.user.id;
    if (!q) {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        "Search query is empty!",
        { users: [] }
      );
    }

    const users = await User.findAll({
      where: {
        id: { [Op.ne]: currentUserId },
        is_deleted: false,

        [Op.and]: [

          // 🔎 search by name or email
          {
            [Op.or]: [
              { full_name: { [Op.iLike]: `%${q}%` } },
              { email: { [Op.iLike]: `%${q}%` } }
            ]
          },

          // 🏢 organization filter
          {
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

        ]
      },

      attributes: [
        "id",
        "full_name",
        "email",
        "phone",
        "role",
        "designation",
      ],
      include: [
        {
          model: SharedFile,
          as: "uploadedFiles",
          where: {chat_id: null, message_id: null},
          attributes: ["file_url"],
          required: false
        }
      ],
      distinct: true

    });

    const formattedUsers = users.map(user => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      designation: user.designation,
      profile_url: user.uploadedFiles?.[0]?.file_url ? BASE_URL+user.uploadedFiles?.[0]?.file_url : null
    }));

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Users retrieved successfully!",
      formattedUsers
    );

  } catch (err) {

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