module.exports = (sequelize, DataTypes) => {
    const ChatMember = sequelize.define("ChatMember", {
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
        user_id: {
            type: DataTypes.UUID,
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
            defaultValue: "member"
        },
        joined_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        muted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
        // 🔴 ADD LATER:
        // is_left
        // left_at
        // last_read_message_id
    },{
        tableName: "chat_members",
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ["chat_id", "user_id"],
            },
        ],
    }
);
return ChatMember;
};