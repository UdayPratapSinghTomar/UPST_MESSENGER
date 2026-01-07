module.exports = (sequelize, DataTypes) => {
    const MessageMention = sequelize.define('MessageMention', {
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
        mentioned_user_id: {
            type: DataTypes.INTEGER,
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
        tableName: 'message_mentions',
        timestamps: true,
        underscored: true
    }
);
return MessageMention;
};