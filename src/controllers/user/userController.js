const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendResponse, HttpsStatus } = require("../../utils/response");
const { Op } = require("sequelize");
const { sequelize, User, sharedFile } = require("../../models");

exports.usersByOrgId = async (req, res) => {
  try {
    const orgId = req.org_id;

    const organizationUsers = await User.findAll({
      where: {
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
      attributes: [
        "id",
        "full_name",
        "email",
        "profile_url",
        "designation",
        "is_online",
        "last_seen"
      ]
    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Organization users retreive successfully!",
      organizationUsers
    );
  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      { server: err.message }
    );
  }
};

exports.updateProfile = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const file = req.file;
    const { bio } = req.body;
    const userId = req.user.id;

    if (!file && !bio) {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        "Nothing to update!"
      );
    }
    
    // const user = await User.findByPk(userId, { transaction: t });
    // if(!user){
    //     return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User not found!');
    // }

    if (bio) {
      await User.update(bio, { where: { id: userId }, transaction: t });
    }

    if (file) {
      const fileUrl = `/uploads/${file.filename}`;
      const file_type = file.mimetype.startsWith("image") ? "image" : null;

      await sharedFile.create(
        {
          user_id: userId,
          file_name: file.originalname,
          file_url: fileUrl,
          file_type,
          file_size: file.size,
          mime_type: file.mimetype,
        },
        {
          transaction: t,
        }
      );
    }
    await t.commit();

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Profile updated successfully!"
    );
  } catch (err) {
    await t.rollback();
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      { server: err.message }
    );
  }
};