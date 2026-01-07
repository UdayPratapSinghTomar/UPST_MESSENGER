module.exports = (sequelize, DataTypes) => {
    const Assignees = sequelize.define('Assignees', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        full_name: {
            type: DataTypes.STRING
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: { isEmail: true }
        },
        role: {
            type: DataTypes.STRING
        },
        department: {
            type: DataTypes.STRING
        },
        profile_image: {
            type: DataTypes.TEXT
        },
        org_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'organizations',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        permission: {
            type: DataTypes.STRING
        },
        otp: {
            type: DataTypes.STRING
        },
        otp_generated_at: {
            type: DataTypes.DATE
        },
        invite_status: {
            type: DataTypes.STRING
        }
    },{
        tableName: 'assignees',
        timestamps: true,
        underscored: true
    });

    return Assignees;
}