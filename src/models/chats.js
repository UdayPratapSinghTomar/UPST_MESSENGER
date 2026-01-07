module.exports = (sequelize, DataTypes) => {
  const Chat = sequelize.define('Chat', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    type: {
      type: DataTypes.ENUM('private', 'group', 'channel'),
      allowNull: false,
    },
    group_name: {
      type: DataTypes.STRING
    },
    group_image: {
      type: DataTypes.TEXT
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
    // 🔴 ADD LATER:
    // last_message_id -> messages.id
    // is_archived
    // is_muted_global
  },
  {
    tableName: 'chats',
    timestamps: true,
    underscored: true,
  }
);
return Chat;
};