module.exports = (sequelize, DataTypes) => {
    const ChatMember = sequelize.define('ChatMember', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        chat_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'chats',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        role: {
            type: DataTypes.ENUM('admin', 'member'),
            defaultValue: 'member'
        },
        joined_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        muted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        last_read_message_id: {
            type: DataTypes.INTEGER,
        },
        last_read_at: {
            type: DataTypes.DATE
        },
        is_left : {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        left_at: {
            type: DataTypes.DATE
        }
    },{
        tableName: 'chat_members',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['chat_id', 'user_id'],
            },
        ],
    }
);
return ChatMember;
};