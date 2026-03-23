const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendResponse, HttpsStatus } = require("../../utils/response");
const { userBelongsToOrg } = require("../../utils/organizationFilter");
const { Op } = require("sequelize");
const { sequelize, User, SharedFile } = require("../../models");
const sharedFiles = require("../../models/sharedFiles");
const BASE_URL = process.env.BASE_URL;

exports.usersByOrgId = async (req, res) => {
  try {

    const orgId = req.org_id;
    const currentUserId = req.user.id;

    const users = await User.findAll({
      where: {
        is_deleted: false,
        id: { [Op.ne]: currentUserId },
        ...userBelongsToOrg(orgId)
      },

      attributes: [
        "id",
        "full_name",
        "designation",
        "is_online",
        "last_seen"
      ],

      include: [
        {
          model: SharedFile,
          as: "uploadedFiles",
          attributes: ["file_url"],
          // where: { file_type: "image" },
          where: { chat_id: null, message_id: null, user_id: { [Op.ne]: null } },
          required: false,
          separate: true,
          limit: 1,
          order: [["createdAt", "DESC"]]
        }
      ]
    });

    const formattedUsers = users.map(user => ({
      id: user.id,
      full_name: user.full_name,
      designation: user.designation,
      is_online: user.is_online,
      last_seen: user.last_seen,
      profile_url: user.uploadedFiles?.[0]?.file_url ? BASE_URL+user.uploadedFiles?.[0]?.file_url : null
    }));

    return sendResponse(res, 200, true, "Users fetched", formattedUsers);

  } catch (err) {
    return sendResponse(res, 500, false, "Server error!", null, { server: err.message });
  }
};

// exports.usersByOrgId = async (req, res) => {
//   try {
//     const orgId = req.org_id;
//     const currentUserId = req.user.id;

//     const users = await User.findAll({
//       where: {
//         is_deleted: false,
//         id: { [Op.ne]: currentUserId },

//         [Op.or]: [
//           { organization_id: orgId },
//           { org_2: orgId },
//           { org_3: orgId },
//           { org_4: orgId },
//           { org_5: orgId },
//           { org_6: orgId },
//           { org_7: orgId },
//           { org_8: orgId },
//           { org_9: orgId },
//           { org_10: orgId }
//         ]
//       },

//       attributes: [
//         "id",
//         "full_name",
//         "email",
//         "designation",
//         "is_online",
//         "last_seen"
//       ],

//       include: [
//         {
//           model: SharedFile,
//           as: "uploadedFiles",
//           attributes: ["file_url"],
//           required: false,
//           // where: { file_type: "image" }
//         }
//       ]
//     });

//     const formattedUsers = users.map(user => ({
//       id: user.id,
//       full_name: user.full_name,
//       email: user.email,
//       designation: user.designation,
//       is_online: user.is_online,
//       last_seen: user.last_seen,
//       profile_url: user?.uploadedFiles?.[0]?.file_url || null
//     }));

//     return sendResponse(
//       res,
//       HttpsStatus.OK,
//       true,
//       "Organization users retrieved successfully!",
//       formattedUsers
//     );
//   } catch (err) {
//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       "Server error!",
//       null,
//       { server: err.message }
//     );
//   }
// };

// exports.activeUsers = async (req, res) => {
//   try {

//     const org_id = req.org_id;
//     const currentUserId = req.user.id;

//     if (!org_id) {
//       return sendResponse(
//         res,
//         HttpsStatus.BAD_REQUEST,
//         false,
//         "Organization id is missing!"
//       );
//     }

//     const users = await User.findAll({
//       where: {
//         is_deleted: false,
//         is_online: true,
//         id: { [Op.ne]: currentUserId },

//         [Op.or]: [
//           { organization_id: org_id },
//           { org_2: org_id },
//           { org_3: org_id },
//           { org_4: org_id },
//           { org_5: org_id },
//           { org_6: org_id },
//           { org_7: org_id },
//           { org_8: org_id },
//           { org_9: org_id },
//           { org_10: org_id }
//         ]
//       },

//       attributes: [
//         "id",
//         "full_name",
//         "designation",
//         "is_online",
//         "last_seen"
//       ],

//       include: [
//         {
//           model: SharedFile,
//           as: "uploadedFiles",
//           attributes: ["file_url"],
//           required: false,
//           // where: { file_type: "image" }
//         }
//       ]
//     });

//     const formattedUsers = users.map(u => ({
//       id: u.id,
//       full_name: u.full_name,
//       designation: u.designation,
//       is_online: u.is_online,
//       last_seen: u.last_seen,
//       profile_url: u?.uploadedFiles?.[0]?.file_url || null
//     }));

//     return sendResponse(
//       res,
//       HttpsStatus.OK,
//       true,
//       "Active users retrieved successfully!",
//       formattedUsers
//     );

//   } catch (err) {

//     return sendResponse(
//       res,
//       HttpsStatus.INTERNAL_SERVER_ERROR,
//       false,
//       "Server error!",
//       null,
//       { server: err.message }
//     );

//   }
// };

exports.activeUsers = async (req, res) => {
  try {

    const org_id = req.org_id;
    const currentUserId = req.user.id;

    if (!org_id) {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        "Organization id is missing!"
      );
    }

    // ✅ Reusable org condition
    const orgCondition = {
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

    const users = await User.findAll({
      where: {
        is_deleted: false,
        is_online: true,
        id: { [Op.ne]: currentUserId },
        ...orgCondition
      },

      attributes: [
        "id",
        "full_name",
        "designation",
        "is_online",
        "last_seen"
      ],

      include: [
        {
          model: SharedFile,
          as: "uploadedFiles",
          attributes: ["file_url"],
          // where: { file_type: "image" }, // ✅ only profile images
          where: { chat_id: null, message_id: null, user_id: { [Op.ne]: null } }, // ✅ only profile images
          required: false,
          separate: true,                // ✅ avoids duplication
          limit: 1,                      // ✅ only latest
          order: [["createdAt", "DESC"]] // ✅ latest first
        }
      ]
    });

    // ✅ Clean response format
    const formattedUsers = users.map(user => ({
      id: user.id,
      full_name: user.full_name,
      designation: user.designation,
      is_online: user.is_online,
      last_seen: user.last_seen,
      profile_url: user.uploadedFiles?.[0]?.file_url ? BASE_URL+user.uploadedFiles?.[0]?.file_url : null
    }));

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Active users retrieved successfully!",
      formattedUsers
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
    console.log('inside')
    const file = req.file;
    const { bio } = req.body;
    const userId = req.user.id;

    if (!file && !bio) {
      await t.rollback();
      return sendResponse(res, 400, false, "Nothing to update!");
    }

    await SharedFile.destroy({
      where: {
        user_id: userId,
        [Op.and]: [
          {
            message_id: null,
            chat_id: null
          }
        ]
      }
    });

    const user = await User.findOne({
      where: { id: userId, is_deleted: false },
      transaction: t
    });
    // console.log('user')
    if (!user) {
      await t.rollback();
      return sendResponse(res, 400, false, "User not found!");
    }

    // ✅ Bio update fix
    if (bio) {
      await User.update(
        { bio },
        { where: { id: userId }, transaction: t }
      );
    }
    console.log(bio)
    // ✅ File fix
    if (file) {
      await SharedFile.create({
        user_id: userId,
        file_name: file.originalname,
        file_url: `uploads/${file.filename}`, // 🔥 FIXED
        file_type: file.mimetype.startsWith("image") ? "image" : null,
        file_size: file.size,
        mime_type: file.mimetype
      }, { transaction: t });
    }

    await t.commit();

    return sendResponse(res, HttpsStatus.OK, true, "Profile updated successfully!");

  } catch (err) {

    if (!t.finished) await t.rollback();
    console.log("errror",err)
    return sendResponse(res, 500, false, "Server error!", null, { server: err.message });
  }
};