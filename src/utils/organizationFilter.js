const { Op } = require("sequelize");

function userBelongsToOrg(org_id) {
  return {
    [Op.or]: [
      { organization_id: org_id },
      { org_2: org_id },
      { org_3: org_id },
      { org_4: org_id },
      { org_5: org_id },
      { org_6: org_id },
      { org_7: org_id },
      { org_8: org_id },
      { org_9: org_id },
      { org_10: org_id }
    ]
  };
}

module.exports = { userBelongsToOrg };