module.exports = (sequelize, DataTypes) => {
    const ActivityLog = sequelize.define('ActivityLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
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
        user_type: {
            type: DataTypes.STRING
        },
        action_type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        module: {
            type: DataTypes.STRING
        },
        description: {
            type: DataTypes.TEXT
        },
        previous_data: {
            type: DataTypes.JSONB
        },
        new_data: {
            type: DataTypes.JSONB
        },
        ip_address: {
            type: DataTypes.STRING
        },
        user_agent: {
            type: DataTypes.TEXT
        },
        location: {
            type: DataTypes.TEXT
        }
    },
    {
        tableName: 'activity_logs',
        timestamps: true,
        underscored: true
    });

    return ActivityLog;
}