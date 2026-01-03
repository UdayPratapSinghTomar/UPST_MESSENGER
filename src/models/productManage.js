module.exports = (sequelize, DataTypes) => {
    const ProductManage = sequelize.define('ProductManage', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT
        },
        status: {
            type: DataTypes.STRING
        },
        org_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'organizations',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        display_order: {
            type: DataTypes.UUID
        },
        deadline: {
            type: DataTypes.DATE
        },
        assignee: {
            type: DataTypes.JSON
        },
        label: {
            type: DataTypes.STRING
        }
    },
    {
        tableName: 'product_manage',
        timestamps: true,
        underscored: true
    });

    return ProductManage;
}