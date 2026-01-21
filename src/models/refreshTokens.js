module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: { 
      type: DataTypes.INTEGER, 
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
    device_id: {
      type: DataTypes.STRING
    },
    revoked_at: {
      type: DataTypes.DATE
    }
  },
  {
    tableName: 'refresh_tokens',
    timestamps: true,
    underscored: true,
  }
);
return RefreshToken;
};