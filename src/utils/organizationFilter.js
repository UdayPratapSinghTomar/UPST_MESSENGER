function userBelongsToOrg(user, org_id) {
  const userOrgs = [
    user.organization_id,
    user.org_2,
    user.org_3,
    user.org_4,
    user.org_5,
    user.org_6,
    user.org_7,
    user.org_8,
    user.org_9,
    user.org_10
  ].filter(Boolean);

  return userOrgs.includes(org_id);
}

module.exports = { userBelongsToOrg };