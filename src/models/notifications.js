module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define('Notification', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        recipient_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        sender_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'SET NULL',
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
        message_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'messages',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        type: {                    // message | mention | group | system
            type: DataTypes.STRING,
            allowNull: false
        },
        event: {                        // fine-grained event
            type: DataTypes.STRING,      // e.g. "group_added", "message_received" etc
            allowNull: false
        },
        title: {
            type: DataTypes.STRING
        },
        body: {
            type: DataTypes.TEXT
        },
        is_read: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        // delivered: {
        //     type: DataTypes.BOOLEAN,
        //     defaultValue: false
        // }
    },{
        tableName: 'notifications',
        timestamps: true,
        underscored: true,
    });

    return Notification;
};