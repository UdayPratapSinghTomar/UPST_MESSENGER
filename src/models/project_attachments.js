module.exports = (sequelize, DataTypes) => {
  const ProjectAttachment = sequelize.define('ProjectAttachment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'projects',
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
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    mime_type: DataTypes.TEXT,

    uploaded_by: {
      type: DataTypes.UUID,
      allowNull: false,
      // ⚠️ Not in SQL, but SHOULD exist logically
      references: {
        model: 'profiles',
        key: 'id'
      }
    }

  }, {
    tableName: 'project_attachments',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  return ProjectAttachment;
};