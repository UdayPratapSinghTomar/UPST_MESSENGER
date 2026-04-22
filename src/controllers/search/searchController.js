const { sequelize, User, Chat, ChatMember, Message,  MessageMention, SharedFile } = require('../../models');
const { Op } = require('sequelize');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const BASE_URL = process.env.BASE_URL;
const { userBelongsToOrg, chatOrgFilter } = require("../../utils/organizationFilter");

exports.searchAll = async (req, res) => {
  try {

    const user_id = req.user.id;
    const { org_id } = req.body
    const q = req.query.search?.trim();

    if (!q) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Search bar is empty!", { users: [], groups: [], messages: [], files: [] });
    }

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
      // where: {
      //   id: { [Op.ne]: user_id },
      //   is_deleted: false,
        
      //   ...userBelongsToOrg(org_id),
      //   [Op.and]: [
      //     {
      //       [Op.or]: [
      //         { full_name: { [Op.iLike]: `%${q}%` } },
      //         { email: { [Op.iLike]: `%${q}%` } }
      //       ]
      //     },
      //   ]
      // },
      where: {
        [Op.and]: [
          { id: { [Op.ne]: user_id } },
          { is_deleted: false },

          userBelongsToOrg(org_id),

          {
            [Op.or]: [
              { full_name: { [Op.iLike]: `%${q}%` } },
              { email: { [Op.iLike]: `%${q}%` } }
            ]
          }
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
        // where: {
        //   type: "private",
        //   organization_id: org_id,
        //   is_deleted: false
        // },
        where: {
          [Op.and]: [
            { type: "private" },
            { is_deleted: false },
            chatOrgFilter(org_id)
          ]
        },
        include: [
          {
            model: ChatMember,
            as: "memberships",
            include: [{
              model: User,
              as: "user",
              // where: { is_deleted: false, ...userBelongsToOrg(org_id) }
              where: {
                [Op.and]: [
                  { is_deleted: false },
                  userBelongsToOrg(org_id)
                ]
              },
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
      // where: {
      //   type: "group",
      //   organization_id: org_id,
      //   group_name: { [Op.iLike]: `%${q}%` },
      //   is_deleted: false
      // },
      where: {
        [Op.and]: [
          { type: "group" },
          { is_deleted: false },
          chatOrgFilter(org_id),

          { group_name: { [Op.iLike]: `%${q}%` } }
        ]
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
            // where: { is_deleted: false, ...userBelongsToOrg(org_id) },
            where: {
              [Op.and]: [
                { is_deleted: false },
                userBelongsToOrg(org_id)
              ]
            },
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
          // where: {
          //   organization_id: org_id,
          //   is_deleted: false
          // },
          where: {
            [Op.and]: [
              { is_deleted: false },
              chatOrgFilter(org_id)
            ]
          },
          include: [{
            model: ChatMember,
            as: "memberships",
            attributes: ["user_id"],
            required: false,
            include: [{
              model: User,
              as: "user",
              // where: {
              //   is_deleted: false,
              //   ...userBelongsToOrg(org_id)
              // },
              where: {
                [Op.and]: [
                  { is_deleted: false },
                  userBelongsToOrg(org_id)
                ]
              },
              attributes: ["id", "full_name"],
              required: true
            }]
          }]
        },
        {
          model: User,
          as: "sender",
          // where: { is_deleted: false, ...userBelongsToOrg(org_id) },
          where: {
            [Op.and]: [
              { is_deleted: false },
              userBelongsToOrg(org_id)
            ]
          },
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
          // where: {
          //   organization_id: org_id,
          //   is_deleted: false
          // },
          where: {
            [Op.and]: [
              { is_deleted: false },
              chatOrgFilter(org_id)
            ]
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
          // where: { is_deleted: false, ...userBelongsToOrg(org_id) },
          where: {
            [Op.and]: [
              { is_deleted: false },
              userBelongsToOrg(org_id)
            ]
          },
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

exports.searchChatMessages = async (req, res) => {
  try {

    const { chat_id } = req.params;
    const q = req.query.search?.trim();
    const user_id = req.user.id;
    const { org_id } = req.body
    
    if (!q) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Search query is empty!", []);
    }

    // ✅ Chat validation
    const chat = await Chat.findOne({
      where: {
        [Op.and]: [
          { id: chat_id },
          { is_deleted: false },
          chatOrgFilter(org_id)
        ]        
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
        where: {
        [Op.and]: [
            { is_deleted: false },
            userBelongsToOrg(org_id)
          ]
        },
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
          where: {
            [Op.and]: [
              { is_deleted: false },
              userBelongsToOrg(org_id)
            ]
          },
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
    console.log(err)
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
    const { org_id } = req.body
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
        [Op.and]: [
          { id: { [Op.ne]: currentUserId } },
          { is_deleted: false },
          userBelongsToOrg(org_id),

          // 🔎 search by name or email
          {
            [Op.or]: [
              { full_name: { [Op.iLike]: `%${q}%` } },
              { email: { [Op.iLike]: `%${q}%` } }
            ]
          },

          // 🏢 organization filter
          // {
          //   ...userBelongsToOrg(org_id)
          // }

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

exports.searchTasks = async (req, res) => {
  try {
    const supabase = req.supabase;
    const { org_id } = req.params;
    const category  = req.query.category?.trim();
    const q = req.query.search?.trim();

    // =========================
    // ✅ VALIDATION
    // =========================
    if (!org_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "org_id is required");
    }

    if (!q) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Search query is required");
    }

    const searchText = q.trim();

    // =========================
    // 📌 FETCH TASKS
    // =========================
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        priority,
        status,
        due_date,
        created_at,
        project_id,
        created_by_user_id
      `)
      .eq("organization_id", org_id)
      .eq("category", category)
      .is("deleted_at", null)
      .or(`title.ilike.%${searchText}%,description.ilike.%${searchText}%`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!tasks || tasks.length === 0) {
      return sendResponse(res, HttpsStatus.OK, true, "No tasks found", []);
    }

    const taskIds = tasks.map(t => t.id);

    // =========================
    // 👥 ASSIGNMENTS
    // =========================
    const { data: assignments } = await supabase
      .from("task_assignments")
      .select("task_id, user_id")
      .in("task_id", taskIds);

    const allUserIds = [
      ...new Set([
        ...(assignments || []).map(a => a.user_id),
        ...tasks.map(t => t.created_by_user_id)
      ])
    ];

    // =========================
    // 👤 USERS
    // =========================
    const { data: users } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", allUserIds);

    const userMap = {};
    users?.forEach(u => {
      userMap[u.id] = u;
    });

    // =========================
    // 👥 GROUP ASSIGNEES
    // =========================
    const assignmentMap = {};
    assignments?.forEach(a => {
      if (!assignmentMap[a.task_id]) {
        assignmentMap[a.task_id] = [];
      }

      if (userMap[a.user_id]) {
        assignmentMap[a.task_id].push({
          id: userMap[a.user_id].id,
          full_name: userMap[a.user_id].full_name,
          avatar_url: userMap[a.user_id].avatar_url
        });
      }
    });

    // =========================
    // 📁 PROJECTS
    // =========================
    const projectIds = tasks.map(t => t.project_id).filter(Boolean);

    let projectMap = {};
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title")
        .in("id", projectIds);

      projects?.forEach(p => {
        projectMap[p.id] = p;
      });
    }

    // =========================
    // 🎯 FINAL RESPONSE
    // =========================
    const formatted = tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
      created_at: t.created_at,

      project: t.project_id
        ? {
            id: t.project_id,
            title: projectMap[t.project_id]?.title || null
          }
        : null,

      created_by: userMap[t.created_by_user_id] || null,

      assigned_to: assignmentMap[t.id] || [],
      total_assigned: (assignmentMap[t.id] || []).length
    }));

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Tasks fetched",
      formatted
    );

  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Error",
      null,
      { server: err.message }
    );
  }
};