module.exports = (sequelize, DataTypes) => {
    const Message = sequelize.define('Message', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        chat_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'chats',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        sender_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        message_type: {
            type: DataTypes.STRING,
            defaultValue: 'text'
        },
        content: {
            type: DataTypes.TEXT
        },
        file_url: {
            type: DataTypes.TEXT
        },
        replied_to_message_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'messages',
                key: 'id'
            },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        },
        is_deleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        edited_at: {
            type: DataTypes.DATE
        },
        edit_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
        // 🔴 ADD LATER:
        // forwarded_from_message_id
        // system_event_type
        // deleted_for_all_at
    },{
        tableName: 'messages',
        timestamps: true,
        underscored: true,
    }
);
return Message;
};