const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendResponse, HttpsStatus } = require("../../utils/response");
const { userBelongsToOrg } = require("../../utils/organizationFilter");
const { Op } = require("sequelize");
const { sequelize, User, SharedFile, Chat, ChatMember } = require("../../models");
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

    return sendResponse(res, HttpsStatus.OK, true, "Users fetched", formattedUsers);

  } catch (err) {
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
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

    const users = await User.findAll({
      where: {
        is_deleted: false,
        is_online: true,
        id: { [Op.ne]: currentUserId },
        ...userBelongsToOrg(org_id)
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
    // console.log('inside')
    const file = req.file;
    const { bio } = req.body;
    const userId = req.user.id;
    const orgId = req.org_id;

    if (!file && !bio) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Nothing to update!");
    }

    console.log("bio 0---- ",bio)

    const user = await User.findOne({
      where: { id: userId, is_deleted: false, ...userBelongsToOrg(orgId) },
      transaction: t
    });
    // console.log('user')
    if (!user) {
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "User not found!");
    }

    if(file){
      await SharedFile.destroy({
        where: {
          user_id: userId,
          message_id: null,
          chat_id: null
        }
      });
    }

    // ✅ Bio update fix
    if (bio) {
      const updatedBio = bio.trim();
      const user = await User.update(
        { bio: updatedBio },
        { where: { id: userId }, transaction: t }
      );
      console.log('usersdfdsfafdfs',user)
    }
    // console.log(bio)
    // ✅ File fix
    if (file) {
      await SharedFile.create({
        user_id: userId,
        file_name: file.originalname,
        file_url: `uploads/${file.filename}`, // 🔥 FIXED
        file_type: file.mimetype.startsWith("image") ? "image" : "file",
        file_size: file.size,
        mime_type: file.mimetype
      }, { transaction: t });
    }

    await t.commit();

    return sendResponse(res, HttpsStatus.OK, true, "Profile updated successfully!");

  } catch (err) {

    if (!t.finished) await t.rollback();
    console.log("errror",err)
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
  }
};

exports.fetchProfile = async (req, res) => {
  try {
    const { user_id } = req.params;
    const orgId = req.org_id;

    if(!user_id){
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User id is required!');
    }

    const profile = await User.findOne({
      where: {
        id: user_id,
        is_deleted: false,
        ...userBelongsToOrg(orgId)
      },
      include: [{
        model: SharedFile,
        as: 'uploadedFiles',
        attributes: ["file_url"],
        where: {chat_id: null, message_id: null, user_id: {[Op.ne]: null}},
        required: false,
        separate: true,
        limit: 1,
        order:[["createdAt", "DESC"]]
      }]
    });

    if (!profile) {
      return sendResponse(
        res,
        HttpsStatus.NOT_FOUND,
        false,
        "User not found"
      );
    }
    const formattedProfile = {
      id: profile.id,
      full_name: profile.full_name,
      designation: profile.designation,
      bio: profile.bio,
      is_online: profile.is_online,
      last_seen: profile.last_seen,
      profile_url: profile.uploadedFiles?.[0]?.file_url ? BASE_URL+profile.uploadedFiles?.[0]?.file_url : null
    };

    return sendResponse(res, HttpsStatus.OK, true, "Profile fetched", formattedProfile);
  } catch (err) {
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message });
  }
};

exports.updateGroupProfile = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const currentUserId = req.user.id;
    const { chat_id, group_name, group_description } = req.body;
    const file = req.file;
    const orgId = req.org_id;

    if(!chat_id){
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Chat id is required!');
    }

    if(!file && !group_name && !group_description){
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Nothing to Update!');
    }

    const user = await User.findOne({
      where: {
        id: currentUserId,
        is_deleted: false,
        ...userBelongsToOrg(orgId)
      },
      transaction: t
    });

    if(!user){
      await t.rollback();
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'User not found!');
    }

    const chatMember = await ChatMember.findAll({
      where: {
        user_id: currentUserId,
        chat_id
      },
      transaction: t
    });

    if(!chatMember){
      await t.rollback();
      return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'User not belongs to chat!')
    }

    if(file){
      await SharedFile.destroy({
        where: {
          user_id: currentUserId,
          chat_id,
          [Op.and]: [
            {
              message_id: null,
            }
          ]
        },
        transaction: t
      });

      await SharedFile.create({
        user_id: currentUserId,
        chat_id: chat_id,
        file_name: file.originalname,
        file_url: `uploads/${file.filename}`,
        file_type: file.mimetype.startsWith("image") ? "image" : "file",
        file_size: file.size,
        mime_type: file.mimetype
      }, { transaction: t})      ;
    }

    const updateData = {};
    if (group_name) updateData.group_name = group_name;
    if (group_description) updateData.group_description = group_description;

    if (Object.keys(updateData).length > 0) {
      await Chat.update(updateData, {
        where: { id: chat_id },
        transaction: t
      });
    }

    await t.commit();

    return sendResponse(res, HttpsStatus.OK, true, 'Group profile updated successfully');
  } catch (err) {
    if (!t.finished) await t.rollback();
    return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server errror!");
  }
}

exports.fetchGroupProfile = async (req, res) => {
  try {
    const { chat_id } = req.params;
    const currentUserId = req.user.id;
    const orgId = req.org_id;

    if (!chat_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Chat id is required!");
    }

    /**
     * ✅ Validate chat (must be group)
     */
    const chat = await Chat.findOne({
      where: {
        id: chat_id,
        type: "group",
        organization_id: orgId,
        is_deleted: false
      },
      include: [
        {
          model: ChatMember,
          as: "memberships",
          attributes: ["user_id"],
          include: [
            {
              model: User,
              as: "user",
              where: {
                is_deleted: false,
                ...userBelongsToOrg(orgId)
              },
              attributes: ["id", "full_name"],
              required: true
            }
          ]
        },
        {
          model: SharedFile,
          as: "files",
          where: {
            message_id: null,
            chat_id: { [Op.ne]: null },
            user_id: { [Op.ne]: null }
          },
          attributes: ["file_url", "user_id", "created_at"],
          required: false,
          separate: true,
          limit: 1,
          order: [["created_at", "DESC"]]
        }
      ]
    });

    if (!chat) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Invalid group!");
    }

    /**
     * ✅ Check membership
     */
    const isMember = chat.memberships.some(m => m.user_id === currentUserId);

    if (!isMember) {
      return sendResponse(res, HttpsStatus.FORBIDDEN, false, "Not authorized!");
    }

    /**
     * ✅ Members (exclude current user)
     */
    const chat_members = chat.memberships
      ?.map(m => m.user)
      ?.filter(u => u && u.id !== currentUserId)
      ?.map(u => ({
        id: u.id,
        full_name: u.full_name
      })) || [];

    /**
     * ✅ Group Image (latest)
     */
    const file = chat.files?.[0] || null;

    const group_image = file?.file_url
      ? BASE_URL + file.file_url
      : null;

    /**
     * ✅ Final response
     */
    const response = {
      chat_id: chat.id,
      group_name: chat.group_name,
      group_description: chat.group_description || null,

      group_image,

      uploaded_by: file?.user_id || null,
      is_you: file?.user_id === currentUserId,

      chat_members
    };

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Group profile fetched!",
      response
    );

  } catch (error) {
    console.error("fetchGroupProfile error:", error);

    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      { server: error.message }
    );
  }
};