module.exports = (sequelize, DataTypes) => {
  const TaskAttachment = sequelize.define('TaskAttachment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    task_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'tasks',
        key: 'id'
      }
    },

    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },

    file_path: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    file_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    file_size: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },

    mime_type: DataTypes.TEXT,

    uploaded_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'profiles',
        key: 'id'
      }
    }

  }, {
    tableName: 'task_attachments',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  return TaskAttachment;
};