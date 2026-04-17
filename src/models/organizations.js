module.exports = (sequelize, DataTypes) => {
  const Organization = sequelize.define('Organization', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    slug: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    employee_size: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    logo_url: DataTypes.TEXT,
    scheduled_deletion_at: DataTypes.DATE,
    is_suspended: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    suspended_at: DataTypes.DATE,
    suspended_by: {
      type: DataTypes.UUID,
      references: {
        model: 'profiles',
        key: 'id'
      }
    },
    suspension_reason: DataTypes.TEXT
  }, {
    tableName: 'organizations',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return Organization;
};