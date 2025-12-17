module.exports = (sequelize, DataTypes) => {
  const SavedMessage = sequelize.define("SavedMessage", {
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
    message_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
          model: 'messages',
          key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    saved_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "saved_messages",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "message_id"],
      },
    ],
  }
);
return SavedMessage;
};