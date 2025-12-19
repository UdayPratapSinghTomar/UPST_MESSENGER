module.exports = (sequelize, DataTypes) => {
  const Organization = sequelize.define('Organization', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    employee_size: {
      type: DataTypes.STRING
    },
    website: {
      type: DataTypes.STRING
    },
    // 🔴 ADD LATER:
    // subscription_plan
    // is_active
    // billing_email
  },
  {
    tableName: 'organizations',
    timestamps: true,
    underscored: true,
  }
);
return Organization;
};