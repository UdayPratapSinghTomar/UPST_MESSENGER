module.exports = (sequelize, DataTypes) => {
  const SharedFile = sequelize.define('SharedFile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
    chat_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
          model: 'chats',
          key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
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
    file_name: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    file_url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    file_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    file_size: {
      type: DataTypes.STRING,
      allowNull: false
    }
    // 🔴 ADD LATER:
    // mime_type
    // duration (audio/video)
    // thumbnail_url
  },
  {
    tableName: 'shared_files',
    timestamps: true,
    underscored: true,
  }
);
return SharedFile;
};