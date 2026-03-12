const { User, Chat, ChatMember, Message, SharedFile } = require('../../models');
const { Op } = require('sequelize');
const { sendResponse, HttpsStatus } = require('../../utils/response');

exports.searchAll = async (req, res) => {
try {

const user_id = req.user.id;
const org_id = req.org_id;
const { q } = req.query;

if (!q) {
  return sendResponse(
    res,
    HttpsStatus.BAD_REQUEST,
    false,
    "Search bar is empty!",
    { users: [], privateChats: [], groups: [], messages: [] }
  );
}

/**
 * 1️⃣ USERS
 */
const usersRaw = await User.findAll({
  where: {
    id: { [Op.ne]: user_id },
    is_deleted: false,
    full_name: { [Op.iLike]: `%${q}%` },

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

  attributes: ["id", "full_name"],

  include: [
    {
      model: SharedFile,
      as: "uploadedFiles",
      attributes: ["file_url"],
      required: false,
      where: { file_type: "image" }
    }
  ]
});

const users = usersRaw.map(u => ({
  id: u.id,
  full_name: u.full_name,
  profile_url: u.uploadedFiles?.[0]?.file_url ?? null
}));


/**
 * 2️⃣ PRIVATE CHATS
 */
const privateChatsRaw = await Chat.findAll({
  where: {
    type: "private",
    organization_id: org_id,
    is_deleted: false
  },

  include: [
    {
      model: ChatMember,
      as: "memberships",
      attributes: ["user_id"],

      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "full_name"],

          include: [
            {
              model: SharedFile,
              as: "uploadedFiles",
              attributes: ["file_url"],
              required: false,
              where: { file_type: "image" }
            }
          ]
        }
      ]
    }
  ],

  attributes: ["id", "type"]
});

const privateChats = privateChatsRaw
  .filter(chat => chat.memberships?.some(m => m.user_id === user_id))
  .map(chat => {

    const otherUser = chat.memberships
      ?.map(m => m.user)
      ?.find(u => u && u.id !== user_id);

    return {
      chat_id: chat.id,
      type: chat.type,
      name: otherUser?.full_name ?? null,
      profile_url: otherUser?.uploadedFiles?.[0]?.file_url ?? null
    };
  });


/**
 * 3️⃣ GROUPS
 */
const groups = await Chat.findAll({
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
      where: { user_id },
      attributes: []
    }
  ],

  attributes: ["id", "group_name", "group_image"]
});


/**
 * 4️⃣ MESSAGES
 */
const messagesRaw = await Message.findAll({
  where: {
    [Op.or]: [
      { content: { [Op.iLike]: `%${q}%` } },
      { "$files.file_name$": { [Op.iLike]: `%${q}%` } }
    ]
  },

  include: [
    {
      model: Chat,
      as: "chat",
      attributes: ["id", "type", "group_name"],
      where: {
        organization_id: org_id,
        is_deleted: false
      },

      include: [
        {
          model: ChatMember,
          as: "memberships",
          where: { user_id },
          attributes: []
        }
      ]
    },

    {
      model: User,
      as: "sender",
      attributes: ["id", "full_name"],

      include: [
        {
          model: SharedFile,
          as: "uploadedFiles",
          attributes: ["file_url"],
          required: false,
          where: { file_type: "image" }
        }
      ]
    },

    {
      model: SharedFile,
      as: "files",
      attributes: ["id", "file_name", "file_url"],
      required: false
    }
  ],

  attributes: ["id", "content", "created_at"],
  order: [["created_at", "DESC"]],
  distinct: true
});

const messages = messagesRaw.map(msg => ({
  id: msg.id,
  content: msg.content,
  created_at: msg.created_at,

  sender: {
    id: msg.sender?.id ?? null,
    full_name: msg.sender?.full_name ?? null,
    profile_url: msg.sender?.uploadedFiles?.[0]?.file_url ?? null
  },

  files: msg.files ?? []
}));


/**
 * FINAL RESPONSE
 */
return sendResponse(
  res,
  HttpsStatus.OK,
  true,
  "Data retrieved successfully!",
  { users, privateChats, groups, messages }
);


} catch (err) {

console.error("searchAll error:", err);

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


exports.searchChatMessages = async (req, res) => {
  try {

    const { chat_id } = req.body;
    const { q } = req.query;
    const user_id = req.user.id;
    const org_id = req.org_id;

    if (!q) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Search query is empty!", []);
    }

    /**
     * Check chat belongs to organization
     */
    const chat = await Chat.findOne({
      where: {
        id: chat_id,
        organization_id: org_id,
        is_deleted: false
      }
    });

    if (!chat) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Invalid organization chat");
    }

    /**
     * Check membership
     */
    const membership = await ChatMember.findOne({
      where: { chat_id, user_id }
    });

    if (!membership) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "You are not a member of this chat");
    }

    /**
     * Search messages
     */
    const messages = await Message.findAll({
      where: {
        chat_id,
        content: { [Op.iLike]: `%${q}%` }
      },

      include: [
        {
          model: SharedFile,
          as: "files",
          attributes: ["file_name", "file_url"],
          required: false,
          where: {
            file_name: { [Op.iLike]: `%${q}%` }
          }
        },

        {
          model: User,
          as: "sender",
          attributes: ["id", "full_name"],
          include: [
            {
              model: SharedFile,
              as: "uploadedFiles",
              attributes: ["file_url"],
              required: false,
              where: { file_type: "image" }
            }
          ]
        }
      ],

      attributes: ["id", "chat_id", "sender_id", "content", "created_at"],
      order: [["created_at", "DESC"]],
      limit: 50,
      distinct: true
    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Chat messages retrieved successfully!",
      messages
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

    const { q } = req.query;
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
        is_deleted: false,
        id: { [Op.ne]: currentUserId },

        [Op.and]: [

          // 🔎 search by name or email
          {
            [Op.or]: [
              { full_name: { [Op.like]: `%${q}%` } },
              { email: { [Op.like]: `%${q}%` } }
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
        "profile_url",
        "designation",
      ],

    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Users retrieved successfully!",
      users
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