module.exports = (sequelize, DataTypes) => {
  const Profile = sequelize.define('Profile', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      // ❌ NO defaultValue → must come from auth.users
    },

    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },

    full_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    job_role: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    phone_number: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    scheduled_deletion_at: DataTypes.DATE,

    onboarding_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    is_virtual_assistant: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    welcome_email_sent_at: DataTypes.DATE,

    bio: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },

    avatar_url: DataTypes.TEXT,
    banner_url: DataTypes.TEXT,

    onboarding_step: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    onboarding_project_id: DataTypes.UUID,

    onboarding_tasks_generated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    onboarding_team_invited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    onboarding_step_id: DataTypes.TEXT,

    must_reset_password: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }

  }, {
    tableName: 'profiles',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return Profile;
};