const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

/**
 * ============================
 * MODEL IMPORTS
 * ============================
 */
const User = require('./users')(sequelize, DataTypes);
const Organization = require('./organizations')(sequelize, DataTypes);
const Chat = require('./chats')(sequelize, DataTypes);
const ChatMember = require('./chatMembers')(sequelize, DataTypes);
const Message = require('./messages')(sequelize, DataTypes);
const MessageStatus = require('./messageStatus')(sequelize, DataTypes);
const MessageMention = require('./messageMentions')(sequelize, DataTypes);
const SharedFile = require('./sharedFiles')(sequelize, DataTypes);
const SavedMessage = require('./savedMessages')(sequelize, DataTypes);
const Contact = require('./contacts')(sequelize, DataTypes);
const RefreshToken = require('./refreshTokens')(sequelize, DataTypes);
const Task = require('./tasks')(sequelize, DataTypes);
const ProductManage = require('./productManage')(sequelize, DataTypes);
const ActivityLog = require('./activityLogs')(sequelize, DataTypes);
const APIUsedTable = require('./apiUsedTable')(sequelize, DataTypes);
const Priorities = require('./priorities')(sequelize, DataTypes);

/**
 * ============================
 * RELATIONS (HEART OF CHAT APP)
 * ============================
 */

/**
 * ORGANIZATION → USERS
 * One organization can have many users
 * (Microsoft Teams / Slack style org-based users)
 */
Organization.hasMany(User, {
  foreignKey: 'organization_id',
  as: 'users'
})
User.belongsTo(Organization, {
  foreignKey: 'organization_id',
  as: 'organization'
})

/**
 * USER → CHAT (CREATOR)
 * A user can create many chats (groups or private)
 */
User.hasMany(Chat, {
  foreignKey: 'created_by',
  as: 'createdChats'
})
Chat.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'createdBy'
})

/**
 * USER ↔ CHAT (MEMBERSHIP)
 * Many users can join many chats
 * This is WhatsApp / Telegram core logic
 */
User.belongsToMany(Chat, {
  through: ChatMember,
  foreignKey: 'user_id',
  otherKey: 'chat_id',
  as: 'memberChats'
})
Chat.belongsToMany(User, {
  through: ChatMember,
  foreignKey: 'chat_id',
  otherKey: 'user_id',
  as: 'members'
})

/**
 * CHAT → CHAT MEMBERS
 * Used to store role, mute, join date, etc.
 */
Chat.hasMany(ChatMember, {
  foreignKey: 'chat_id',
  as: 'memberships'
})
ChatMember.belongsTo(Chat, {
  foreignKey: 'chat_id',
  as: 'chat'
})

User.hasMany(ChatMember, {
  foreignKey: 'user_id',
  as: 'chatMemberships'
})
ChatMember.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

/**
 * CHAT → MESSAGES
 * A chat contains many messages
 */
Chat.hasMany(Message, {
  foreignKey: 'chat_id',
  as: 'messages'
})
Message.belongsTo(Chat, {
  foreignKey: 'chat_id',
  as: 'chat'
})

/**
 * USER → MESSAGE (SENDER)
 * Every message is sent by one user
 */
User.hasMany(Message, {
  foreignKey: 'sender_id',
  as: 'sentMessages'
})
Message.belongsTo(User, {
  foreignKey: 'sender_id',
  as: 'sender'
})

/**
 * MESSAGE → MESSAGE STATUS
 * Stores delivered/read status per user
 * WhatsApp double tick / blue tick logic
 */
Message.hasMany(MessageStatus, {
  foreignKey: 'message_id',
  as: 'statuses'
})
MessageStatus.belongsTo(Message, {
  foreignKey: 'message_id',
  as: 'message'
})

User.hasMany(MessageStatus, {
  foreignKey: 'user_id',
  as: 'messageStatuses'
})
MessageStatus.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

/**
 * MESSAGE → MENTIONS
 * Used when user mentions @someone in message
 */
Message.hasMany(MessageMention, {
  foreignKey: 'message_id',
  as: 'mentions'
})
MessageMention.belongsTo(Message, {
  foreignKey: 'message_id',
  as: 'message'
})

User.hasMany(MessageMention, {
  foreignKey: 'mentioned_user_id',
  as: 'mentions'
})
MessageMention.belongsTo(User, {
  foreignKey: 'mentioned_user_id',
  as: 'mentionedUser'
})

/**
 * MESSAGE → SHARED FILES
 * Images, videos, voice notes, documents
 */
Message.hasMany(SharedFile, {
  foreignKey: 'message_id',
  as: 'files'
})
SharedFile.belongsTo(Message, {
  foreignKey: 'message_id',
  as: 'message'
})

User.hasMany(SharedFile, {
  foreignKey: 'user_id',
  as: 'uploadedFiles'
})
SharedFile.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'uploader'
})

Chat.hasMany(SharedFile, {
  foreignKey: 'chat_id',
  as: 'files'
})
SharedFile.belongsTo(Chat, {
  foreignKey: 'chat_id',
  as: 'chat'
})

/**
 * USER → SAVED MESSAGES
 * Starred messages feature (WhatsApp)
 */
User.hasMany(SavedMessage, {
  foreignKey: 'user_id',
  as: 'savedMessages'
})
SavedMessage.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

Message.hasMany(SavedMessage, {
  foreignKey: 'message_id',
  as: 'savedBy'
})
SavedMessage.belongsTo(Message, {
  foreignKey: 'message_id',
  as: 'message'
})

/**
 * USER → CONTACTS
 * User address book (WhatsApp contacts)
 */
User.hasMany(Contact, {
  foreignKey: 'user_id',
  as: 'contacts'
})
Contact.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'owner'
})

User.hasMany(Contact, {
  foreignKey: 'contact_user_id',
  as: 'asContact'
})

/**
 * USER → REFRESH TOKENS
 * Login & session management
 */
User.hasMany(RefreshToken, {
  foreignKey: 'user_id',
  as: 'refreshTokens'
})
RefreshToken.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
})

/**
 * USER → TASKS
 */
User.hasMany(Task, {
  foreignKey: 'created_by',
  as: 'createdTasks'
})
User.hasMany(Task, {
  foreignKey: 'assigned_to',
  as: 'assignedTasks'
})

Task.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator'
})
Task.belongsTo(User, {
  foreignKey: 'assigned_to',
  as: 'assignee'
})

/**
 * USER → PRODUCTMANAGE
 */

ProductManage.belongsTo(Organization, {
  foreignKey: 'org_id',
  as: 'productOrganization'
});

Organization.hasMany(ProductManage, {
  foreignKey: 'org_id',
  as: 'organizationProducts'
});

/**
 * USER → ACTIVITYLOGS
 */

ActivityLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'activityUser'
});

User.hasMany(ActivityLog, {
  foreignKey: 'user_id',
  as: 'userActivities'
});

/**
 * USER → APIUSEDTABLE
 */

APIUsedTable.belongsTo(Organization, {
  foreignKey: 'organization_id',
  as: 'apiUsedOrganization'
});

Organization.hasMany(APIUsedTable, {
  foreignKey: 'organization_id',
  as: 'organizationActivities'
});

/**
 * ============================
 * EXPORT
 * ============================
 */
module.exports = {
  sequelize,
  User,
  Organization,
  Chat,
  ChatMember,
  Message,
  MessageStatus,
  MessageMention,
  SharedFile,
  SavedMessage,
  Contact,
  RefreshToken,
  Task,
  ProductManage,
  ActivityLog,
  APIUsedTable,
  Priorities
}