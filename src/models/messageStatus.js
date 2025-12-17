module.exports = (sequelize, DataTypes) => {
    const MessageStatus = sequelize.define("MessageStatus", {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        message_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'messages',
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
        status: {
            type: DataTypes.STRING
        }
        // 🔴 ADD LATER:
        // delivered_at
        // read_at
    },
    {
        tableName: "message_status",
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ["message_id", "user_id"],
            },
        ]
    }
)
return MessageStatus;
};