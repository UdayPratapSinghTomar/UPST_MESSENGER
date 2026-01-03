module.exports = (sequelize, DataTypes) => {
    const APIUsedTable = sequelize.define('APIUsedTable', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        organization_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'organizations',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        table_name: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        feature: {
            type: DataTypes.STRING
        }
    },
    {
        tableName: 'api_used_table',
        timestamps: true,
        underscored: true
    });

    return APIUsedTable;
};