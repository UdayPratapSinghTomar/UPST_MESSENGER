module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    full_name: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    phone: { 
      type: DataTypes.STRING
    },
    password: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    // login_type: {
    //   type: DataTypes.ENUM('email', 'phone', 'oauth'),
    //   allowNull: false,
    //   defaultValue: 'email',
    // },
    // is_email_verified: {
    //   type: DataTypes.BOOLEAN,
    //   defaultValue: false,
    // },
    // is_phone_verified: {
    //   type: DataTypes.BOOLEAN,
    //   defaultValue: false,
    // },
    role: {
      type: DataTypes.STRING,
    },
    profile_url: { 
      type: DataTypes.TEXT
    },
    bio: {
      type: DataTypes.STRING
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    last_seen: { 
      type: DataTypes.DATE
    },
    fcmToken: {
      type: DataTypes.TEXT
    },
    organization_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
          model: 'organizations',
          key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    two_fa_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    reset_token: { 
      type: DataTypes.STRING
    },
    reset_token_expiry: { 
      type: DataTypes.DATE
    },
    status: {
      type: DataTypes.ENUM('active', 'blocked', 'suspended'),
      defaultValue: 'active',
    },
    subscription: {
      type: DataTypes.STRING,
      defaultValue: 'free',
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    designation: { 
      type: DataTypes.STRING
    },
    location: { 
      type: DataTypes.STRING
    },
    position: { 
      type: DataTypes.STRING
    },
    // 🔴 add join org ids table here and remove from here
    org_2: { 
      type: DataTypes.INTEGER
    },
    org_3: { 
      type: DataTypes.INTEGER
    },
    org_4: { 
      type: DataTypes.INTEGER
    },
    org_5: { 
      type: DataTypes.INTEGER
    },
    org_6: { 
      type: DataTypes.INTEGER
    },
    org_7: { 
      type: DataTypes.INTEGER
    },
    org_8: { 
      type: DataTypes.INTEGER
    },
    org_9: { 
      type: DataTypes.INTEGER
    },
    org_10: { 
      type: DataTypes.INTEGER
    },
    join_date: { 
      type: DataTypes.STRING
    },
    // 🔴 ADD LATER:
    // login_type (email | phone | oauth)
    // is_email_verified
    // is_phone_verified
    // device_type
    // device_last_seen_at
    // last_active_ip
  },
  {
    tableName: 'users',
    timestamps: true,
    underscored: true,
  }
);

User.findUserByEmail = async function(email) {
  return await User.findOne({ where: { email } });
};

return User;
};