module.exports = (sequelize, DataTypes) => {
    const MessageMention = sequelize.define("MessageMention", {
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
        mentioned_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        }
    },
    {
        tableName: "message_mentions",
        timestamps: true,
        underscored: true
    }
);
return MessageMention;
};