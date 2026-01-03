module.exports = (sequelize, DataTypes) => {
    const Priorities = sequelize.define('Priorities', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        }
    },
    {
        tableName: 'priorities',
        timestamps: true,
        underscored: true
    });

    return Priorities;
}