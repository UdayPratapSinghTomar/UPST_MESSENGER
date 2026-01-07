module.exports = (sequelize, DataTypes) => {
    const MessageStatus = sequelize.define('MessageStatus', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        message_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'messages',
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
        status: {
            type: DataTypes.ENUM('sent', 'delivered', 'read'),
            allowNull: false,
            defaultValue: 'sent'
        },
        delivered_at: {
            type: DataTypes.DATE,
        },
        read_at: {
            type: DataTypes.DATE,
        }
    },
    {
        tableName: 'message_status',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['message_id', 'user_id', 'chat_id'],
            },
        ]
    }
)
return MessageStatus;
};