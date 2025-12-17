const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

/**
 * ============================
 * MODEL IMPORTS
 * ============================
 */
const User = require('./users')(sequelize, DataTypes)
const Organization = require('./organizations')(sequelize, DataTypes)
const Chat = require('./chats')(sequelize, DataTypes)
const ChatMember = require('./chatMembers')(sequelize, DataTypes)
const Message = require('./messages')(sequelize, DataTypes)
const MessageStatus = require('./messageStatus')(sequelize, DataTypes)
const MessageMention = require('./messageMentions')(sequelize, DataTypes)
const SharedFile = require('./sharedFiles')(sequelize, DataTypes)
const SavedMessage = require('./savedMessages')(sequelize, DataTypes)
const Contact = require('./contacts')(sequelize, DataTypes)
const RefreshToken = require('./refreshTokens')(sequelize, DataTypes)
const Task = require('./tasks')(sequelize, DataTypes)

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
  foreignKey: 'organization_id'
})
User.belongsTo(Organization, {
  foreignKey: 'organization_id'
})

/**
 * USER → CHAT (CREATOR)
 * A user can create many chats (groups or private)
 */
User.hasMany(Chat, {
  foreignKey: 'created_by'
})
Chat.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator'
})

/**
 * USER ↔ CHAT (MEMBERSHIP)
 * Many users can join many chats
 * This is WhatsApp / Telegram core logic
 */
User.belongsToMany(Chat, {
  through: ChatMember,
  foreignKey: 'user_id',
  otherKey: 'chat_id'
})
Chat.belongsToMany(User, {
  through: ChatMember,
  foreignKey: 'chat_id',
  otherKey: 'user_id'
})

/**
 * CHAT → CHAT MEMBERS
 * Used to store role, mute, join date, etc.
 */
Chat.hasMany(ChatMember, {
  foreignKey: 'chat_id'
})
ChatMember.belongsTo(Chat, {
  foreignKey: 'chat_id'
})

User.hasMany(ChatMember, {
  foreignKey: 'user_id'
})
ChatMember.belongsTo(User, {
  foreignKey: 'user_id'
})

/**
 * CHAT → MESSAGES
 * A chat contains many messages
 */
Chat.hasMany(Message, {
  foreignKey: 'chat_id'
})
Message.belongsTo(Chat, {
  foreignKey: 'chat_id'
})

/**
 * USER → MESSAGE (SENDER)
 * Every message is sent by one user
 */
User.hasMany(Message, {
  foreignKey: 'sender_id'
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
  foreignKey: 'message_id'
})
MessageStatus.belongsTo(Message, {
  foreignKey: 'message_id'
})

User.hasMany(MessageStatus, {
  foreignKey: 'user_id'
})
MessageStatus.belongsTo(User, {
  foreignKey: 'user_id'
})

/**
 * MESSAGE → MENTIONS
 * Used when user mentions @someone in message
 */
Message.hasMany(MessageMention, {
  foreignKey: 'message_id'
})
MessageMention.belongsTo(Message, {
  foreignKey: 'message_id'
})

User.hasMany(MessageMention, {
  foreignKey: 'mentioned_user_id'
})
MessageMention.belongsTo(User, {
  foreignKey: 'mentioned_user_id'
})

/**
 * MESSAGE → SHARED FILES
 * Images, videos, voice notes, documents
 */
Message.hasMany(SharedFile, {
  foreignKey: 'message_id'
})
SharedFile.belongsTo(Message, {
  foreignKey: 'message_id'
})

User.hasMany(SharedFile, {
  foreignKey: 'user_id'
})
SharedFile.belongsTo(User, {
  foreignKey: 'user_id'
})

Chat.hasMany(SharedFile, {
  foreignKey: 'chat_id'
})
SharedFile.belongsTo(Chat, {
  foreignKey: 'chat_id'
})

/**
 * USER → SAVED MESSAGES
 * Starred messages feature (WhatsApp)
 */
User.hasMany(SavedMessage, {
  foreignKey: 'user_id'
})
SavedMessage.belongsTo(User, {
  foreignKey: 'user_id'
})

Message.hasMany(SavedMessage, {
  foreignKey: 'message_id'
})
SavedMessage.belongsTo(Message, {
  foreignKey: 'message_id'
})

/**
 * USER → CONTACTS
 * User address book (WhatsApp contacts)
 */
User.hasMany(Contact, {
  foreignKey: 'user_id'
})
Contact.belongsTo(User, {
  foreignKey: 'user_id'
})

User.hasMany(Contact, {
  foreignKey: 'contact_user_id',
  as: 'contact_of'
})

/**
 * USER → REFRESH TOKENS
 * Login & session management
 */
User.hasMany(RefreshToken, {
  foreignKey: 'user_id'
})
RefreshToken.belongsTo(User, {
  foreignKey: 'user_id'
})

/**
 * USER → TASKS
 * Teams-like task assignment
 */
User.hasMany(Task, {
  foreignKey: 'created_by'
})
User.hasMany(Task, {
  foreignKey: 'assigned_to',
  as: 'assigned_tasks'
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
  Task
}
