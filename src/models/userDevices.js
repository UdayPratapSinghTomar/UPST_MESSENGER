module.exports = (sequelize, DataTypes) => {
    const UserDevice = sequelize.define('UserDevice', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            // autoIncrement: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        device_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        device_type: {
            type: DataTypes.ENUM('android', 'ios', 'web'),
            allowNull: false
        },
        fcm_token: {
            type: DataTypes.TEXT
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        last_seen_at: {
            type: DataTypes.DATE
        }
    },{
        tableName: 'user_devices',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'device_id'],
            }
        ]
    });

    return UserDevice;
}; 