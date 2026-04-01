// module.exports = (sequelize, DataTypes) => {
//     const Project = sequelize.define('Project', {
//         id: {
//             type: DataTypes.UUID,
//             defaultValue: DataTypes.UUIDV4,
//             primaryKey: true
//         },
//         user_id: {
//             type: DataTypes.UUID,
//             allowNull: false,
//             references: {
//                 model: 'users',
//                 key: 'id'
//             },
//             onDelete: 'CASCADE',
//             onUpdate: 'CASCADE'
//         },
//         organization_id: {
//             type: DataTypes.UUID,
//             allowNull: false,
//             references: {
//                 model: 'organizations',
//                 key: 'id'
//             },
//             onDelete: 'CASCADE',
//             onUpdate: 'CASCADE'
//         },
//         title: {
//             type: DataTypes.TEXT
//         },
//         description: {
//             type: DataTypes.TEXT
//         },
//         status: {
//             type: DataTypes.TEXT
//         },
//         position: {
//             type: DataTypes.INTEGER
//         },
//         due_date: {
//             type: DataTypes.DATE
//         },
//         archived_at: {
//             type: DataTypes.DATE
//         },
//         deleted_at: {
//             type: DataTypes.DATE
//         }
//     },
//     {
//         tableName: 'projects',
//         timestamps: true,
//         underscored: true,
//     });
//     return Project;
// }