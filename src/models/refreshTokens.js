module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { 
      type: DataTypes.UUID, 
      allowNull: false,
      references: {
          model: 'users',
          key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    token: { 
      type: DataTypes.STRING
    },
    expires_at: { 
      type: DataTypes.DATE, 
      allowNull: false 
    },
    // 🔴 ADD LATER:
    // device_id
    // revoked_at
  },
  {
    tableName: 'refresh_tokens',
    timestamps: true,
    underscored: true,
  }
);
return RefreshToken;
};