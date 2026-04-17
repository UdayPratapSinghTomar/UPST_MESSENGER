module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define('UserRole', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      // ⚠️ Do NOT reference auth.users in Sequelize
      // Supabase handles this constraint
    },

    organization_id: {
      type: DataTypes.UUID,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },

    role: {
      type: DataTypes.ENUM(
        'super_admin',
        'admin',
        'member',
        'viewer'
      ), // ❌ removed 'individual'
      allowNull: false,
      defaultValue: 'member'
    }

  }, {
    tableName: 'user_roles',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  return UserRole;
};