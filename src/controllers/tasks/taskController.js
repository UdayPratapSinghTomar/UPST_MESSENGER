const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const { getPublicFileUrl } = require('../../utils/fileUrl');
const { generateAccessToken, generateRefreshToken, expiryDateFromNow} = require('../../utils/tokens');

const { User, RefreshToken, Organization, sequelize, SharedFile, UserDevice } = require('../../models');
const { verifyRefreshToken } = require('../../utils/tokens');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sendEmail = require('../../utils/sendEmail');
const EVENTS = require('../../utils/socketEvents');
const { supabase, supabaseAdmin } = require('../../config/database'); //

const { createClient } = require('@supabase/supabase-js');

exports.testconnection = async (req, res) => {
    const { data, error } = await supabase.from('profiles').select('*');
    // const { data: user } = await supabase.auth.getUser();
    // console.log(user);
    if (error) {
        console.error('❌ Supabase connection failed:', error.message);
    } else {
        console.log('✅ Supabase connected successfully!');
        console.log('Data:', data);
    }
}

exports.createTask = async (req, res) => {
  let createdProjectId = null;
  let createdTaskId = null;
  let uploadedFiles = [];

  try {
    const userId = req.user_id;
    const supabase = req.supabase; // ✅ IMPORTANT (RLS FIX)

    let {
      title,
      description,
      project_id,
      new_project_title,
      due_date,
      priority = 'medium',
      category = 'product', // ✅ from request
      assigned_users = [],
      is_recurring = false,
      is_draft = false,
      urls = [],
      org_id
    } = req.body;

    // =========================
    // 🔄 PARSE (multipart fix)
    // =========================
    if (typeof assigned_users === 'string') {
      assigned_users = JSON.parse(assigned_users);
    }

    if (typeof urls === 'string') {
      urls = JSON.parse(urls);
    }

    // =========================
    // ✅ VALIDATION
    // =========================
    if (!title) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Task title is required");
    }

    if (!assigned_users || assigned_users.length === 0) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "At least one assigned user is required");
    }

    // =========================
    // ✅ FILTER VALID URLS ONLY
    // =========================
    const isValidUrl = (url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    const validUrls = urls.filter(url => isValidUrl(url));

    // =========================
    // 👤 PROFILE (GET ORG)
    // =========================
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error("User not found");
    }

    const organizationId = org_id || profile.organization_id;

    // =========================
    // 📁 PROJECT
    // =========================
    let finalProjectId = project_id || null;

    if (!project_id && new_project_title) {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          title: new_project_title,
          user_id: userId,
          organization_id: organizationId
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      createdProjectId = project.id;
      finalProjectId = project.id;
    }

    // =========================
    // 📌 TASK
    // =========================
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        category, // ✅ FROM REQUEST
        user_id: userId,
        organization_id: organizationId,
        project_id: finalProjectId,
        due_date,
        priority,
        is_recurring,
        is_draft,
        created_by_user_id: userId,
        assigned_user_id: assigned_users[0]
      })
      .select()
      .single();

    if (taskError) throw new Error(taskError.message);

    createdTaskId = task.id;

    // =========================
    // 👥 ASSIGNMENTS
    // =========================
    const assignments = assigned_users.map(uid => ({
      task_id: createdTaskId,
      user_id: uid,
      assigned_by: userId
    }));

    const { error: assignError } = await supabase
      .from('task_assignments')
      .insert(assignments);

    if (assignError) throw new Error(assignError.message);

    // =========================
    // 🔗 URLS (VALID ONLY)
    // =========================
    if (validUrls.length > 0) {
      const urlData = validUrls.map(url => ({
        task_id: createdTaskId,
        organization_id: organizationId,
        url,
        created_by: userId
      }));

      const { error: urlError } = await supabase
        .from('task_urls')
        .insert(urlData);

      if (urlError) throw new Error(urlError.message);
    }

    // =========================
    // 📎 ATTACHMENTS (MULTER)
    // =========================
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {

        const fileExt = file.originalname.split(".").pop();
        const filePath = `${organizationId || 'individual'}/${createdTaskId}_${Date.now()}.${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("task-attachments")
          .upload(filePath, fs.readFileSync(file.path), {
            contentType: file.mimetype
          });

        if (uploadError) throw new Error(uploadError.message);

        uploadedFiles.push(filePath);

        // Insert DB record
        const { error: dbError } = await supabase
          .from('task_attachments')
          .insert({
            task_id: createdTaskId,
            organization_id: organizationId,
            file_path: filePath,
            file_name: file.originalname,
            file_size: file.size,
            mime_type: file.mimetype,
            uploaded_by: userId
          });

        if (dbError) throw new Error(dbError.message);
      }
    }

    // =========================
    // ✅ SUCCESS
    // =========================
    return sendResponse(res, HttpsStatus.CREATED, true, "Task created successfully", {
      task_id: createdTaskId
    });

  } catch (error) {

    // =========================
    // 🔥 FULL ROLLBACK
    // =========================
    try {
      if (createdTaskId) {
        await req.supabase.from('task_attachments').delete().eq('task_id', createdTaskId);
        await req.supabase.from('task_urls').delete().eq('task_id', createdTaskId);
        await req.supabase.from('task_assignments').delete().eq('task_id', createdTaskId);
        await req.supabase.from('tasks').delete().eq('id', createdTaskId);
      }

      if (createdProjectId) {
        await req.supabase.from('projects').delete().eq('id', createdProjectId);
      }

      if (uploadedFiles.length > 0) {
        await req.supabase.storage
          .from("task-attachments")
          .remove(uploadedFiles);
      }

    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError.message);
    }

    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      error.message || "Transaction failed",
      null,
      { server: error.message }
    );
  }
};

exports.updateTask = async (req, res) => {
  try {
    const supabase = req.supabase;
    const userId = req.user_id;
    const { task_id } = req.params;

    let {
      title,
      description,
      due_date,
      priority,
      category,
      assigned_users = [],
      is_recurring,
      urls = []
    } = req.body;

    if (!task_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "task_id is required");
    }

    // =========================
    // 🔄 PARSE
    // =========================
    if (typeof assigned_users === 'string') {
      assigned_users = JSON.parse(assigned_users);
    }

    if (typeof urls === 'string') {
      urls = JSON.parse(urls);
    }

    // =========================
    // 📌 GET EXISTING TASK
    // =========================
    const { data: existingTask, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', task_id)
      .single();

    if (taskError || !existingTask) {
      return sendResponse(res, HttpsStatus.NOT_FOUND, false, "Task not found");
    }

    const organizationId = existingTask.organization_id;

    // =========================
    // ✅ UPDATE TASK
    // =========================
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        title,
        description,
        due_date,
        priority,
        category,
        is_recurring,
        assigned_user_id: assigned_users[0] || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', task_id);

    if (updateError) throw new Error(updateError.message);

    // =========================
    // 👥 UPDATE ASSIGNMENTS
    // =========================
    const { data: oldAssignments } = await supabase
      .from('task_assignments')
      .select('user_id')
      .eq('task_id', task_id);

    const oldUserIds = oldAssignments.map(a => a.user_id);

    const toAdd = assigned_users.filter(id => !oldUserIds.includes(id));
    const toRemove = oldUserIds.filter(id => !assigned_users.includes(id));

    // ➕ ADD NEW USERS
    if (toAdd.length > 0) {
      const insertData = toAdd.map(uid => ({
        task_id,
        user_id: uid,
        assigned_by: userId
      }));

      await supabase.from('task_assignments').insert(insertData);
    }

    // ➖ REMOVE USERS
    if (toRemove.length > 0) {
      await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', task_id)
        .in('user_id', toRemove);
    }

    // =========================
    // 🔗 UPDATE URLS (REPLACE)
    // =========================
    await supabase.from('task_urls').delete().eq('task_id', task_id);

    const isValidUrl = (url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    const validUrls = urls.filter(isValidUrl);

    if (validUrls.length > 0) {
      const urlData = validUrls.map(url => ({
        task_id,
        organization_id: organizationId,
        url,
        created_by: userId
      }));

      await supabase.from('task_urls').insert(urlData);
    }

    // =========================
    // 📎 ADD NEW ATTACHMENTS
    // =========================
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {

        const fileExt = file.originalname.split(".").pop();
        const filePath = `${organizationId}/${task_id}_${Date.now()}.${fileExt}`;

        // Upload
        const { error: uploadError } = await supabase.storage
          .from("task-attachments")
          .upload(filePath, fs.readFileSync(file.path), {
            contentType: file.mimetype
          });

        if (uploadError) throw new Error(uploadError.message);

        // Save DB
        await supabase
          .from('task_attachments')
          .insert({
            task_id,
            organization_id: organizationId,
            file_path: filePath,
            file_name: file.originalname,
            file_size: file.size,
            mime_type: file.mimetype,
            uploaded_by: userId
          });
      }
    }

    // =========================
    // ✅ SUCCESS
    // =========================
    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Task updated successfully"
    );

  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Error",
      null,
      { server: err.message }
    );
  }
};

exports.getProjects = async (req, res) => {
  try {
    const supabase = req.supabase; // ✅ RLS client
    const { org_id } = req.query;

    if (!org_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "org_id is required");
    }

    const { data, error } = await supabase
      .from('projects')
      .select('id, title')
      .eq('organization_id', org_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Projects fetched",
      data
    );

  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Error",
      null,
      { server: err.message }
    );
  }
};

exports.getAssignees = async (req, res) => {
  try {
    const supabase = req.supabase; // ✅ RLS client
    const { org_id } = req.query;

    if (!org_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "org_id is required");
    }

    // =========================
    // 1️⃣ GET USER ROLES
    // =========================
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('organization_id', org_id);

    if (roleError) throw roleError;

    if (!roles || roles.length === 0) {
      return sendResponse(res, HttpsStatus.OK, true, "Users fetched", []);
    }

    // =========================
    // 2️⃣ GET PROFILES
    // =========================
    const userIds = roles.map(r => r.user_id);

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    if (profileError) throw profileError;

    // =========================
    // 3️⃣ MERGE DATA
    // =========================
    const profileMap = {};
    profiles.forEach(p => {
      profileMap[p.id] = p;
    });

    const formatted = roles.map(r => ({
      user_id: r.user_id,
      role: r.role,
      full_name: profileMap[r.user_id]?.full_name || null,
      avatar_url: profileMap[r.user_id]?.avatar_url || null
    }));

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Users fetched",
      formatted
    );

  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Error",
      null,
      { server: err.message }
    );
  }
};

// exports.getTasksByStatus = async (req, res) => {
//   try {
//     const supabase = req.supabase;
//     const { org_id, status } = req.query;

//     if (!org_id) {
//       return sendResponse(res, 400, false, "org_id is required");
//     }

//     if (!status || !['todo', 'complete'].includes(status)) {
//       return sendResponse(res, 400, false, "Invalid status");
//     }

//     // =========================
//     // 📌 TASKS
//     // =========================
//     const { data: tasks, error } = await supabase
//       .from('tasks')
//       .select(`
//         id, title, description, priority,
//         due_date, created_at, is_recurring,
//         project_id, created_by_user_id
//       `)
//       .eq('organization_id', org_id)
//       .eq('status', status)
//       .is('deleted_at', null)
//       .order('created_at', { ascending: false });

//     if (error) throw error;

//     if (!tasks?.length) {
//       return sendResponse(res, 200, true, "Tasks fetched", []);
//     }

//     const taskIds = tasks.map(t => t.id);

//     // =========================
//     // 👥 ASSIGNMENTS
//     // =========================
//     const { data: assignments } = await supabase
//       .from('task_assignments')
//       .select('task_id, user_id')
//       .in('task_id', taskIds);

//     const allUserIds = [
//       ...new Set([
//         ...(assignments || []).map(a => a.user_id),
//         ...tasks.map(t => t.created_by_user_id)
//       ])
//     ];

//     const { data: users } = await supabase
//       .from('profiles')
//       .select('id, full_name, avatar_url')
//       .in('id', allUserIds);

//     const userMap = {};
//     users?.forEach(u => userMap[u.id] = u);

//     const assignmentMap = {};
//     assignments?.forEach(a => {
//       if (!assignmentMap[a.task_id]) {
//         assignmentMap[a.task_id] = [];
//       }

//       if (userMap[a.user_id]) {
//         assignmentMap[a.task_id].push(userMap[a.user_id]);
//       }
//     });

//     // =========================
//     // 📎 ATTACHMENTS (FIXED URL)
//     // =========================
//     const { data: attachments } = await supabase
//       .from('task_attachments')
//       .select('task_id, file_name, file_path, file_size, mime_type')
//       .in('task_id', taskIds);

//     const attachmentMap = {};
//     attachments?.forEach(a => {
//       if (!attachmentMap[a.task_id]) {
//         attachmentMap[a.task_id] = [];
//       }

//       attachmentMap[a.task_id].push({
//         ...a,
//         file_url: getPublicFileUrl(a.file_path) // ✅ FIX
//       });
//     });

//     // =========================
//     // 🎯 FINAL
//     // =========================
//     const formatted = tasks.map(t => ({
//       id: t.id,
//       title: t.title,
//       description: t.description,
//       priority: t.priority,
//       due_date: t.due_date,
//       created_at: t.created_at,
//       is_recurring: t.is_recurring,

//       created_by: userMap[t.created_by_user_id] || null,
//       assigned_to: assignmentMap[t.id] || [],
//       total_assigned: (assignmentMap[t.id] || []).length,

//       attachments: attachmentMap[t.id] || [],
//       total_attachments: (attachmentMap[t.id] || []).length
//     }));

//     return sendResponse(res, 200, true, "Tasks fetched", formatted);

//   } catch (err) {
//     return sendResponse(res, 500, false, "Error", null, {
//       server: err.message
//     });
//   }
// };

// exports.getTaskDetails = async (req, res) => {
//   try {
//     const supabase = req.supabase;
//     const { task_id } = req.params;

//     if (!task_id) {
//       return sendResponse(res, 400, false, "task_id is required");
//     }

//     // =========================
//     // 📌 TASK
//     // =========================
//     const { data: task } = await supabase
//       .from('tasks')
//       .select('*')
//       .eq('id', task_id)
//       .single();

//     // =========================
//     // 👥 ASSIGNMENTS
//     // =========================
//     const { data: assignments } = await supabase
//       .from('task_assignments')
//       .select('user_id')
//       .eq('task_id', task_id);

//     const userIds = assignments.map(a => a.user_id);

//     const { data: users } = await supabase
//       .from('profiles')
//       .select('id, full_name, avatar_url')
//       .in('id', userIds);

//     const userMap = {};
//     users?.forEach(u => userMap[u.id] = u);

//     // =========================
//     // 📎 ATTACHMENTS (FIXED)
//     // =========================
//     const { data: attachments } = await supabase
//       .from('task_attachments')
//       .select('*')
//       .eq('task_id', task_id);

//     const formattedAttachments = attachments.map(a => ({
//       ...a,
//       file_url: getPublicFileUrl(a.file_path) // ✅ FIX
//     }));

//     return sendResponse(res, 200, true, "Task details fetched", {
//       ...task,
//       assigned_to: userIds.map(id => userMap[id]).filter(Boolean),
//       attachments: formattedAttachments
//     });

//   } catch (err) {
//     return sendResponse(res, 500, false, "Error", null, {
//       server: err.message
//     });
//   }
// };

exports.getTasksByStatus = async (req, res) => {
  try {
    const supabase = req.supabase;

    let { org_id, status } = req.query;

    if (!org_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "org_id is required");
    }

    if (!status || !['todo', 'complete'].includes(status.trim())) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Invalid status (todo | complete)");
    }

    const cleanStatus = status.trim();

    // =========================
    // 📌 FETCH TASKS
    // =========================
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        priority,
        due_date,
        created_at,
        is_recurring,
        project_id,
        created_by_user_id,
        status
      `)
      .eq('organization_id', org_id)
      .eq('status', cleanStatus)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!tasks?.length) {
      return sendResponse(res, HttpsStatus.OK, true, "Tasks fetched", []);
    }

    const taskIds = tasks.map(t => t.id);

    // =========================
    // 📎 FETCH ATTACHMENTS
    // =========================
    const { data: attachments } = await supabase
      .from('task_attachments')
      .select(`
        task_id,
        file_name,
        file_path,
        file_size,
        mime_type
      `)
      .in('task_id', taskIds);

    // =========================
    // 🔥 GENERATE SIGNED URLS (WITH DEBUG)
    // =========================
    const attachmentsWithUrls = await Promise.all(
      (attachments || []).map(async (file) => {
        if (!file.file_path) return { ...file, file_url: null };

        const { data, error } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(file.file_path, 3600);

        if (error) {
          console.error("SIGNED URL ERROR:", error.message, file.file_path);
        }

        return {
          ...file,
          file_url: data?.signedUrl || null
        };
      })
    );

    // =========================
    // 📎 GROUP BY TASK
    // =========================
    const attachmentMap = {};

    attachmentsWithUrls.forEach(a => {
      if (!attachmentMap[a.task_id]) {
        attachmentMap[a.task_id] = [];
      }
      attachmentMap[a.task_id].push(a);
    });

    // =========================
    // 🎯 FINAL RESPONSE
    // =========================
    const formatted = tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
      created_at: t.created_at,
      is_recurring: t.is_recurring,

      attachments: attachmentMap[t.id] || [],
      total_attachments: (attachmentMap[t.id] || []).length
    }));

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Tasks fetched",
      formatted
    );

  } catch (err) {
    console.error("ERROR:", err);
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Error",
      null,
      { server: err.message }
    );
  }
};

exports.getTaskDetails = async (req, res) => {
  try {
    const supabase = req.supabase;
    const { task_id } = req.params;

    if (!task_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "task_id is required");
    }

    // =========================
    // 📌 FETCH TASK
    // =========================
    const { data: task, error } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        priority,
        due_date,
        created_at,
        is_recurring,
        category,
        project_id,
        created_by_user_id,
        status
      `)
      .eq('id', task_id)
      .is('deleted_at', null)
      .single();

    if (error || !task) {
      throw new Error("Task not found");
    }

    // =========================
    // 👥 FETCH ASSIGNMENTS
    // =========================
    const { data: assignments } = await supabase
      .from('task_assignments')
      .select('user_id')
      .eq('task_id', task_id);

    const assignedUserIds = assignments?.map(a => a.user_id) || [];

    // =========================
    // 👤 FETCH USERS
    // =========================
    const allUserIds = [
      ...new Set([
        ...assignedUserIds,
        task.created_by_user_id
      ])
    ];

    let userMap = {};

    if (allUserIds.length > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', allUserIds);

      users?.forEach(u => {
        userMap[u.id] = u;
      });
    }

    // =========================
    // 📁 FETCH PROJECT
    // =========================
    let project = null;

    if (task.project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('id, title')
        .eq('id', task.project_id)
        .single();

      if (proj) project = proj;
    }

    // =========================
    // 📎 FETCH ATTACHMENTS
    // =========================
    const { data: attachments } = await supabase
      .from('task_attachments')
      .select(`
        file_name,
        file_path,
        file_size,
        mime_type
      `)
      .eq('task_id', task_id);

    // 🔥 ADD THIS: generate signed URLs
    const attachmentsWithUrls = await Promise.all(
      (attachments || []).map(async (file) => {
        const { data, error } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(file.file_path, 3600); // 1 hour

        return {
          ...file,
          file_url: error ? null : data?.signedUrl
        };
      })
    );

    // =========================
    // 🔗 FETCH URLS
    // =========================
    const { data: urls } = await supabase
      .from('task_urls')
      .select('url')
      .eq('task_id', task_id);

    // =========================
    // 🎯 FINAL RESPONSE
    // =========================
    const response = {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
      created_at: task.created_at,
      is_recurring: task.is_recurring,
      category: task.category, // 🔥 BOARD (Product)

      project: project,

      created_by: userMap[task.created_by_user_id] || null,

      assigned_to: assignedUserIds.map(uid => {
        return userMap[uid] || {
          id: uid,
          full_name: null,
          avatar_url: null
        };
      }),

      attachments: attachmentsWithUrls,
      total_attachments: attachmentsWithUrls.length,

      urls: urls?.map(u => u.url) || []
    };

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Task details fetched",
      response
    );

  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Error",
      null,
      { server: err.message }
    );
  }
};


// Get all tasks
// exports.getTasks = async (req, res) => {
//   try {
//     const { status, assignment_status } = req.query;

//     let query = supabase.from('tasks').select('*')
//       .order('created_at', { ascending: false });

//       console.log("hnsjhfsd",query)

//     if (status) query = query.eq('status', status);
//     if (assignment_status) query = query.eq('assignment_status', assignment_status);

//     const { data, error } = await query;

//     if (error) throw error;

//     res.json({ success: true,  message:"Task Retrieve Successfully", data });

//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


// // Get single task
// exports.getTaskById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const { data, error } = await supabase
//       .from('tasks')
//       .select('*')
//       .eq('id', id)
//       .single();

//     if (error) throw error;

//     res.json({ success: true, message:"Task Retrieve Successfully", data });

//   } catch (err) {
//     res.status(404).json({ success: false, message: 'Task not found' });
//   }
// };


// // Update task
// exports.updateTask = async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (req.body.status && !['todo', 'completed'].includes(req.body.status)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid status'
//       });
//     }

//     const { data, error } = await supabase
//       .from('tasks')
//       .update(req.body)
//       .eq('id', id)
//       .select()
//       .single();

//     if (error) throw error;

//     res.json({ success: true, message:"Task Updated Successfully", data });

//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


// // Delete task
// exports.deleteTask = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const { error } = await supabase
//       .from('tasks')
//       .delete()
//       .eq('id', id);

//     if (error) throw error;

//     res.json({ success: true, message: 'Task deleted successfully' });

//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


// // Get tasks by status
// exports.getTasksByStatus = async (req, res) => {
//   try {
//     const { status } = req.params;

//     if (!['todo', 'completed'].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid status'
//       });
//     }

//     const { data, error } = await supabase
//       .from('tasks')
//       .select('*')
//       .eq('status', status);

//     if (error) throw error;

//     res.json({ success: true, message:"Task Retrieve Successfully", data });

//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


// // Get task with details
// exports.getTaskByIdAndStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.query;

//     let query = supabase
//       .from('tasks')
//       .select(`
//         *,
//         projects ( id, name ),
//         task_assignees ( user_id )
//       `)
//       .eq('id', id);

//     if (status) {
//       query = query.eq('status', status);
//     }

//     const { data, error } = await query.single();

//     if (error) throw error;

//     res.json({ success: true, message:"Task Retrieve Successfully", data });

//   } catch (err) {
//     res.status(404).json({ success: false, message: 'Task not found' });
//   }
// };


// // Mark task completed
// exports.markTaskCompleted = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const { data, error } = await supabase
//       .from('tasks')
//       .update({
//         status: 'completed',
//         completed_at: new Date()
//       })
//       .eq('id', id)
//       .eq('status', 'todo')
//       .select();

//     if (error) throw error;

//     if (!data.length) {
//       return res.status(400).json({
//         success: false,
//         message: 'Task already completed or not found'
//       });
//     }

//     res.json({
//       success: true,
//       message: 'Task marked as completed',
//       data
//     });

//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


// // Get tasks by assignment status
// exports.getTasksByAssignmentStatus = async (req, res) => {
//   try {
//     const { assignment_status } = req.params;

//     const { data, error } = await supabase
//       .from('tasks')
//       .select('*')
//       .eq('assignment_status', assignment_status);

//     if (error) throw error;

//     res.json({ success: true, message:"Task Retrieve Successfully", data });

//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


// // Mark assignment accepted
// exports.markTaskAssignmentAccepted = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const { data, error } = await supabase
//       .from('tasks')
//       .update({
//         assignment_status: 'accepted'
//       })
//       .eq('id', id)
//       .eq('assignment_status', 'pending')
//       .select();

//     if (error) throw error;

//     if (!data.length) {
//       return res.status(400).json({
//         success: false,
//         message: 'Already accepted or task not found'
//       });
//     }

//     res.json({
//       success: true,
//       message: 'Assignment accepted',
//       data
//     });

//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };
