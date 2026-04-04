// const { Op } = require("sequelize");

// function userBelongsToOrg(org_id) {
//   return {
//     [Op.or]: [
//       { organization_id: org_id },
//       { org_2: org_id },
//       { org_3: org_id },
//       { org_4: org_id },
//       { org_5: org_id },
//       { org_6: org_id },
//       { org_7: org_id },
//       { org_8: org_id },
//       { org_9: org_id },
//       { org_10: org_id }
//     ]
//   };
// }
const { Op } = require("sequelize");

function userBelongsToOrg(org_id) {

  // ✅ CASE 1: org_id is NULL → return users with NO org at all
  if (org_id === "null" || org_id === "" || org_id === undefined) {
    org_id = null;
  }

  if (org_id === null) {
    return {
      [Op.and]: [
        { organization_id: { [Op.is]: null } },
        { org_2: { [Op.is]: null } },
        { org_3: { [Op.is]: null } },
        { org_4: { [Op.is]: null } },
        { org_5: { [Op.is]: null } },
        { org_6: { [Op.is]: null } },
        { org_7: { [Op.is]: null } },
        { org_8: { [Op.is]: null } },
        { org_9: { [Op.is]: null } },
        { org_10: { [Op.is]: null } }
      ]
    };
  }
console.log('outside null')
  // ✅ CASE 2: org_id has value → match ANY column
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

const chatOrgFilter = (org_id) => {
  // if (org_id === "null") org_id = null;
  if (org_id === "null" || org_id === "" || org_id === undefined) {
    org_id = null;
  }

  return org_id === null
    ? { organization_id: { [Op.is]: null } }
    : { organization_id: org_id };
};

module.exports = { userBelongsToOrg, chatOrgFilter };