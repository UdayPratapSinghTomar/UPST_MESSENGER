module.exports = (sequelize, DataTypes) => {
  const SharedFile = sequelize.define('SharedFile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    message_id: {
      type: DataTypes.INTEGER,
      references: {
          model: 'messages',
          key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    chat_id: {
      type: DataTypes.INTEGER,
      references: {
          model: 'chats',
          key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
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
    },
    mime_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    duration: {
      type: DataTypes.INTEGER,
    },
    thumbnail_url: {
      type: DataTypes.TEXT,
    }
  },
  {
    tableName: 'shared_files',
    timestamps: true,
    underscored: true,
  }
);
return SharedFile;
};