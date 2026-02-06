const notificationTypes = {
    // Messages
    MESSAGE_PRIVATE: 'message_private',
    MESSAGE_GROUP: 'message_group',
    MESSAGE_CHANNEL: 'message_channel',

    // Mentions
    MENTION_USER: 'mention_user',

    // Group / Channel events
    CHAT_MEMBER_ADDED: 'chat_member_added',
    CHAT_MEMBER_REMOVED: 'chat_member_removed',
    CHAT_UPDATED: 'chat_updated',
    CHAT_ADMIN_CHANGED: 'chat_admin_changed',

    // Files
    FILE_SHARED: 'file_shared',

    // System / bot
    SYSTEM: 'system'
};

module.exports = notificationTypes;
