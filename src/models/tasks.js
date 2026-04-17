module.exports = (sequelize, DataTypes) => {
  const Task = sequelize.define('Task', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      // NOTE: In your DB this is NOT FK → keep as is
    },

    organization_id: {
      type: DataTypes.UUID,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },

    assigned_user_id: {
      type: DataTypes.UUID,
      references: {
        model: 'profiles',
        key: 'id'
      }
    },

    created_by_user_id: {
      type: DataTypes.UUID,
      references: {
        model: 'profiles',
        key: 'id'
      }
    },

    project_id: {
      type: DataTypes.UUID,
      references: {
        model: 'projects',
        key: 'id'
      }
    },

    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      validate: { len: [0, 2000] }
    },

    status: {
      type: DataTypes.ENUM('todo', 'complete'),
      allowNull: false,
      defaultValue: 'todo',
    },

    icon: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'ListTodo',
    },

    category: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'operational',
    },

    subcategory: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'misc'),
      allowNull: false,
      defaultValue: 'weekly',
    },

    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'medium',
    },

    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    due_date: DataTypes.DATEONLY,

    attachment_url: DataTypes.TEXT,
    attachment_name: DataTypes.TEXT,

    is_recurring: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    is_draft: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    assignment_status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined'),
      allowNull: false,
      defaultValue: 'accepted',
    },

    completed_at: DataTypes.DATE,
    archived_at: DataTypes.DATE,

    deleted_at: DataTypes.DATE,

    decline_reason: DataTypes.TEXT,
    last_reminder_sent_at: DataTypes.DATE,
    reassignment_reason: DataTypes.TEXT,

  }, {
    tableName: 'tasks',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  return Task;
};