module.exports = (sequelize, DataTypes) => {
  const TaskURL = sequelize.define('TaskURL', {
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

    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    title: DataTypes.TEXT,

    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'profiles',
        key: 'id'
      }
    }

  }, {
    tableName: 'task_urls',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  return TaskURL;
};