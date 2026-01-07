module.exports = (sequelize, DataTypes) => {
  const Task = sequelize.define('Task', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
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
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
          model: 'users',
          key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending'
    }
    // 🔴 ADD LATER:
    // due_date
    // priority
    // related_chat_id
  },
  {
    tableName: 'tasks',
    timestamps: true,
    underscored: true,
  }
);
return Task; 
};