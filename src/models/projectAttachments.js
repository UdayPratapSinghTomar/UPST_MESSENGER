// module.exports = (sequelize, DataTypes) => {
//     const ProjectAttachment = sequelize.define('ProjectAttachment', {
//         id: {
//             type: DataTypes.UUID,
//             defaultValue: DataTypes.UUIDV4,
//             primaryKey: true
//         },
//         project_id: {
//             type: DataTypes.UUID,
//             allowNull: false,
//             references: {
//                 modle: 'projects',
//                 key: 'id'
//             },
//             onDelete: 'CASCADE',
//             onUpdate: 'CASCADE'
//         },
//         organization_id: {
//             type: DataTypes.UUID,
//             allowNull: false,
//             references: {
//                 modle: 'organizations',
//                 key: 'id'
//             },
//             onDelete: 'CASCADE',
//             onUpdate: 'CASCADE'
//         },
//         file_path: {
//             type: DataTypes.TEXT
//         },
//         file_name: {
//             type: DataTypes.TEXT
//         },
//         file_size: {
//             type: DataTypes.INTEGER
//         },
//         mime_type: {
//             type: DataTypes.TEXT
//         },
//         uploaded_by: {
//             type: DataTypes.UUID,
//             allowNull: false,
//             references: {
//                 modle: 'users',
//                 key: 'id'
//             },
//             onDelete: 'CASCADE',
//             onUpdate: 'CASCADE'
//         }
//     },{
//         tableName: 'project_attachments',
//         timestamps: true,
//         underscored: true
//     });
//     return ProjectAttachment;
// }