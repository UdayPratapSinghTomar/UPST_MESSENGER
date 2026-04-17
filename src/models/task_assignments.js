module.exports = (sequelize, DataTypes) => {
  const TaskAssignment = sequelize.define('TaskAssignment', {
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

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'profiles',
        key: 'id'
      }
    },

    assigned_by: {
      type: DataTypes.UUID,
      references: {
        model: 'profiles',
        key: 'id'
      }
    },

    assignment_status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined'),
      allowNull: false,
      defaultValue: 'pending',
    },

    accepted_at: DataTypes.DATE,
    declined_at: DataTypes.DATE,
    decline_reason: DataTypes.TEXT,

  }, {
    tableName: 'task_assignments',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  return TaskAssignment;
};