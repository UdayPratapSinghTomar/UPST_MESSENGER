const { Op } = require("sequelize");
const { User, SharedFile } = require("../models");

const getActiveUsers = async (userId, orgId) => {

  const users = await User.findAll({
    where: {
      id: { [Op.ne]: userId },
      is_online: true,
      is_deleted: false,

      [Op.or]: [
        { organization_id: orgId },
        { org_2: orgId },
        { org_3: orgId },
        { org_4: orgId },
        { org_5: orgId },
        { org_6: orgId },
        { org_7: orgId },
        { org_8: orgId },
        { org_9: orgId },
        { org_10: orgId }
      ]
    },

    attributes: ["id", "full_name", "designation", "last_seen"],

    include: [
      {
        model: SharedFile,
        as: "uploadedFiles",
        attributes: ["file_url"],
        required: false,
        where: { file_type: "image" }
      }
    ]
  });

  return users.map(user => ({
    id: user.id,
    full_name: user.full_name,
    designation: user.designation,
    is_online: true,
    last_seen: user.last_seen,
    profile_url: user.uploadedFiles?.[0]?.file_url || null,
  }));
};

module.exports = { getActiveUsers };