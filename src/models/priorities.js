module.exports = (sequelize, DataTypes) => {
    const Priorities = sequelize.define('Priorities', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
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