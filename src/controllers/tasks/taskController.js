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
      priority,
      category,
      subcategory,
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

    if (!is_recurring) {
      subcategory = 'weekly'; // ✅ DEFAULT
    }

    if (is_recurring && !subcategory) {
      return sendResponse(res, 400, false, "subcategory is required for recurring task");
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
        category,
        subcategory,
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
      subcategory,
      assigned_users = [],
      is_recurring,
      urls = []
    } = req.body;

    // =========================
    // ❌ VALIDATION
    // =========================
    if (!task_id) {
      return sendResponse(res, 400, false, "task_id is required");
    }

    if (typeof assigned_users === 'string') {
      assigned_users = JSON.parse(assigned_users);
    }

    if (typeof urls === 'string') {
      urls = JSON.parse(urls);
    }

    if (!assigned_users || assigned_users.length === 0) {
      return sendResponse(res, 400, false, "At least one assigned user required");
    }

    if (!is_recurring) {
      subcategory = 'weekly';
    }

    if (is_recurring && !subcategory) {
      return sendResponse(res, 400, false, "subcategory is required for recurring task");
    }

    // =========================
    // 📌 GET EXISTING TASK
    // =========================
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', task_id)
      .single();

    if (fetchError || !existingTask) {
      return sendResponse(res, 404, false, "Task not found");
    }

    const organizationId = existingTask.organization_id;

    // =========================
    // ✅ UPDATE TASK (FIXED)
    // =========================
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        title,
        description,
        due_date,
        priority,
        is_recurring,
        category,
        subcategory,
        assigned_user_id: assigned_users[0] || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', task_id)
      .select()
      .single();

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      throw new Error(updateError.message);
    }

    if (!updatedTask) {
      return sendResponse(res, 403, false, "Update failed (RLS issue)");
    }

    // =========================
    // 👥 SYNC ASSIGNMENTS
    // =========================
    const { data: oldAssignments } = await supabase
      .from('task_assignments')
      .select('user_id')
      .eq('task_id', task_id);

    const oldUserIds = oldAssignments?.map(a => a.user_id) || [];

    const toAdd = assigned_users.filter(id => !oldUserIds.includes(id));
    const toRemove = oldUserIds.filter(id => !assigned_users.includes(id));

    // ➕ ADD NEW USERS
    if (toAdd.length > 0) {
      const insertData = toAdd.map(uid => ({
        task_id,
        user_id: uid,
        assigned_by: userId,
        assignment_status: 'pending'
      }));

      const { error } = await supabase.from('task_assignments').insert(insertData);
      if (error) throw new Error(error.message);
    }

    // ➖ REMOVE USERS (SOFT DELETE RECOMMENDED)
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', task_id)
        .in('user_id', toRemove);

      if (error) throw new Error(error.message);
    }

    // =========================
    // 🔗 REPLACE URLS
    // =========================
    await supabase.from('task_urls').delete().eq('task_id', task_id);

    const validUrls = (urls || []).filter(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });

    if (validUrls.length > 0) {
      const urlData = validUrls.map(url => ({
        task_id,
        organization_id: organizationId,
        url,
        created_by: userId
      }));

      const { error } = await supabase.from('task_urls').insert(urlData);
      if (error) throw new Error(error.message);
    }

    // =========================
    // 📎 ADD NEW ATTACHMENTS
    // =========================
    if (req.files?.length > 0) {
      for (const file of req.files) {
        const fileExt = file.originalname.split(".").pop();
        const filePath = `${organizationId}/${task_id}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("task-attachments")
          .upload(filePath, fs.readFileSync(file.path), {
            contentType: file.mimetype
          });

        if (uploadError) throw new Error(uploadError.message);

        const { error: dbError } = await supabase
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

        if (dbError) throw new Error(dbError.message);
      }
    }

    // =========================
    // ✅ SUCCESS
    // =========================
    return sendResponse(res, 200, true, "Task updated successfully", {
      task_id: updatedTask.id
    });

  } catch (err) {
    console.error("UPDATE TASK ERROR:", err);

    return sendResponse(res, 500, false, "Error", null, {
      server: err.message
    });
  }
};

exports.deleteTaskAttachment = async (req, res) => {
  try {
    const supabase = req.supabase;
    const userId = req.user_id;
    const { attachment_id } = req.params;

    if (!attachment_id) {
      return sendResponse(res, 400, false, "attachment_id is required");
    }

    // =========================
    // 👤 GET USER ROLE
    // =========================
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return sendResponse(res, 401, false, "User not found");
    }

    // =========================
    // 📌 GET ATTACHMENT
    // =========================
    const { data: file, error: fetchError } = await supabase
      .from('task_attachments')
      .select('id, file_path, uploaded_by')
      .eq('id', attachment_id)
      .single();

    if (fetchError || !file) {
      return sendResponse(res, 404, false, "Attachment not found");
    }

    // =========================
    // 🔐 AUTHORIZATION CHECK
    // =========================
    // const isOwner = file.uploaded_by === userId;
    // const isAdmin = user.role === 'admin';
    // const isModerator = user.role === 'moderator';

    // if (!isOwner && !isAdmin && !isModerator) {
    //   return sendResponse(res, 403, false, "You are not allowed to delete this attachment");
    // }

    // =========================
    // 🗑 DELETE FROM STORAGE
    // =========================
    const { error: storageError } = await supabase.storage
      .from('task-attachments')
      .remove([file.file_path]);

    if (storageError) {
      console.error("STORAGE DELETE ERROR:", storageError);
      throw new Error("Failed to delete file from storage");
    }

    // =========================
    // 🗑 DELETE FROM DB
    // =========================
    const { error: dbError } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', attachment_id);

    if (dbError) {
      console.error("DB DELETE ERROR:", dbError);
      throw new Error("Failed to delete attachment from database");
    }

    // =========================
    // ✅ SUCCESS
    // =========================
    return sendResponse(res, 200, true, "Attachment deleted successfully");

  } catch (err) {
    console.error("DELETE ATTACHMENT ERROR:", err);

    return sendResponse(res, 500, false, "Error", null, {
      server: err.message
    });
  }
};

exports.getTasksByStatus = async (req, res) => {
  try {
    const supabase = req.supabase;
    const user_id = req.user.id;

    let { status } = req.query;
    let { org_id } = req.params;

    if (!org_id) {
      return sendResponse(res, 400, false, "org_id is required");
    }

    if (!status || !['todo', 'complete'].includes(status.trim())) {
      return sendResponse(res, 400, false, "Invalid status (todo | complete)");
    }

    const cleanStatus = status.trim();

    // =========================
    // 📌 FETCH TASKS + ASSIGNMENTS
    // =========================
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        priority,
        category,
        due_date,
        created_at,
        is_recurring,
        project_id,
        created_by_user_id,
        status,

        task_assignments (
          id,
          user_id,
          assignment_status
        )
      `)
      .eq('organization_id', org_id)
      .eq('status', cleanStatus)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!tasks?.length) {
      return sendResponse(res, 200, true, "Tasks fetched", []);
    }

    // =========================
    // 🎯 FILTER LOGIC (IMPORTANT)
    // =========================
    const filteredTasks = tasks.filter(task => {
      const isOwner = task.created_by_user_id === user_id;

      // OWNER → show all
      if (isOwner) return true;

      // NOT OWNER → check assignment
      const myAssignment = task.task_assignments.find(
        a => a.user_id === user_id
      );

      if (!myAssignment) return false;

      return ['pending', 'accepted'].includes(myAssignment.assignment_status);
    });

    const taskIds = filteredTasks.map(t => t.id);

    // =========================
    // 📎 FETCH ATTACHMENTS
    // =========================
    const { data: attachments } = await supabase
      .from('task_attachments')
      .select(`*`)
      .in('task_id', taskIds);

    // =========================
    // 🔗 SIGNED URLS
    // =========================
    const attachmentsWithUrls = await Promise.all(
      (attachments || []).map(async (file) => {
        if (!file.file_path) return { ...file, file_url: null };

        const { data } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(file.file_path, 3600);

        return {
          ...file,
          file_url: data?.signedUrl || null
        };
      })
    );

    // =========================
    // 📎 GROUP ATTACHMENTS
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
    const formatted = filteredTasks.map(t => {
      const myAssignment = t.task_assignments.find(
        a => a.user_id === user_id
      );

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        category: t.category,
        status: t.status,
        due_date: t.due_date,
        created_at: t.created_at,
        is_recurring: t.is_recurring,

        assignment_status: myAssignment?.assignment_status || null,

        attachments: attachmentMap[t.id] || [],
        total_attachments: (attachmentMap[t.id] || []).length
      };
    });

    return sendResponse(
      res,
      200,
      true,
      "Tasks fetched",
      formatted
    );

  } catch (err) {
    console.error("ERROR:", err);
    return sendResponse(
      res,
      500,
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
    const user_id = req.user.id;

    if (!task_id) {
      return sendResponse(res, 400, false, "task_id is required");
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
    // 👥 FETCH ASSIGNMENTS (UPDATED)
    // =========================
    const { data: assignments } = await supabase
      .from('task_assignments')
      .select(`
        user_id,
        assignment_status
      `)
      .eq('task_id', task_id);

    const assignedUserIds = assignments?.map(a => a.user_id) || [];

    // 🔥 CURRENT USER STATUS
    const myAssignment = assignments?.find(a => a.user_id === user_id);

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
      .select(`*`)
      .eq('task_id', task_id);

    const attachmentsWithUrls = await Promise.all(
      (attachments || []).map(async (file) => {
        const { data, error } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(file.file_path, 3600);

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
      category: task.category,

      project: project,

      created_by: userMap[task.created_by_user_id] || null,

      // 🔥 UPDATED: include assignment_status per user
      assigned_to: (assignments || []).map(a => ({
        ...(userMap[a.user_id] || {
          id: a.user_id,
          full_name: null,
          avatar_url: null
        }),
        assignment_status: a.assignment_status
      })),

      // 🔥 IMPORTANT: current user assignment status
      my_assignment_status: myAssignment?.assignment_status || null,

      attachments: attachmentsWithUrls,
      total_attachments: attachmentsWithUrls.length,

      urls: urls?.map(u => u.url) || []
    };

    return sendResponse(
      res,
      200,
      true,
      "Task details fetched",
      response
    );

  } catch (err) {
    return sendResponse(
      res,
      500,
      false,
      "Error",
      null,
      { server: err.message }
    );
  }
};

exports.getPendingTaskRequests = async (req, res) => {
  try {
    const supabase = req.supabase;
    const user_id = req.user.id;
    const { org_id } = req.params;

    if (!org_id) {
      return sendResponse(res, 400, false, "org_id is required");
    }

    // =========================
    // 📌 FETCH PENDING ASSIGNMENTS + TASK DATA
    // =========================
    const { data, error } = await supabase
      .from("task_assignments")
      .select(`
        id,
        task_id,
        assignment_status,
        created_at,

        assigned_by_user:profiles!task_assignments_assigned_by_fkey(
          id,
          full_name
        ),

        task:tasks!task_assignments_task_id_fkey(
          id,
          title,
          description,
          priority,
          due_date,
          category,
          project_id,
          created_by_user_id,
          organization_id,
          status,
          deleted_at,

          project:projects!tasks_project_id_fkey(
            id,
            title
          ),

          created_by_user:profiles!tasks_created_by_user_id_fkey(
            id,
            full_name
          )
        )
      `)
      .eq("user_id", user_id)
      .eq("assignment_status", "pending")
      .eq("task.organization_id", org_id)
      .is("task.deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // =========================
    // 🎯 FORMAT RESPONSE
    // =========================
    const response = (data || []).map((item) => {
      const task = item.task;

      return {
        id: item.id,
        task_id: item.task_id,

        // 🟡 LIST DATA
        title: task.title,
        priority: task.priority,
        due_date: task.due_date,
        created_at: item.created_at,

        assigned_by_user: item.assigned_by_user,

        // 🟢 DETAIL (SHEET DATA)
        description: task.description,
        category: task.category,

        project: task.project || null,

        created_by_user: task.created_by_user || null,

        assignment_status: item.assignment_status
      };
    });

    return sendResponse(
      res,
      200,
      true,
      "Pending task requests fetched",
      response
    );

  } catch (err) {
    return sendResponse(
      res,
      500,
      false,
      "Error",
      null,
      { server: err.message }
    );
  }
};

exports.getMultipleSignedUrls = async (req, res) => {
  try {
    const supabase = req.supabase;
    const { files } = req.body; // array of file_paths

    if (!files || !Array.isArray(files)) {
      return sendResponse(res, 400, false, "files array required");
    }

    const result = await Promise.all(
      files.map(async (file_path) => {
        const { data, error } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(file_path, 3600);

        return {
          file_path,
          signed_url: error ? null : data?.signedUrl
        };
      })
    );

    return sendResponse(res, 200, true, "URLs generated", result);

  } catch (err) {
    return sendResponse(res, 500, false, "Error", null, {
      server: err.message
    });
  }
};

// exports.handleTaskResponse = async (req, res) => {
//   try {
//     const supabase = req.supabase;

//     const {
//       task_id,
//       action, // accept | decline | reassign
//       new_user_id, // only for reassign
//       reason
//     } = req.body;

//     const user_id = req.user.id // current user
//     if (!task_id || !action) {
//       return sendResponse(res, 400, false, "task_id, action required");
//     }

//     // =========================
//     // 📌 VALID ACTION
//     // =========================
//     if (!['accept', 'decline', 'reassign'].includes(action)) {
//       return sendResponse(res, 400, false, "Invalid action");
//     }

//     // =========================
//     // 📌 ACCEPT TASK
//     // =========================
//     if (action === 'accept') {
//       const { error } = await supabase
//         .from('task_assignments')
//         .update({
//           assignment_status: 'accepted',
//           accepted_at: new Date().toISOString(),
//           decline_reason: null
//         })
//         .eq('task_id', task_id)
//         .eq('user_id', user_id);

//       if (error) throw error;

//       await supabase
//         .from('tasks')
//         .update({
//           assignment_status: 'accepted'
//         })
//         .eq('id', task_id);

//       return sendResponse(res, 200, true, "Task accepted");
//     }

//     // =========================
//     // 📌 DECLINE TASK
//     // =========================
//     if (action === 'decline') {
//       if (!reason) {
//         return sendResponse(res, 400, false, "Decline reason required");
//       }

//       const { error } = await supabase
//         .from('task_assignments')
//         .update({
//           assignment_status: 'declined',
//           declined_at: new Date().toISOString(),
//           decline_reason: reason
//         })
//         .eq('task_id', task_id)
//         .eq('user_id', user_id);

//       if (error) throw error;

//       await supabase
//         .from('tasks')
//         .update({
//           assignment_status: 'declined',
//           decline_reason: reason
//         })
//         .eq('id', task_id);

//       return sendResponse(res, 200, true, "Task declined");
//     }

//     // =========================
//     // 📌 REASSIGN TASK
//     // =========================
//     if (action === 'reassign') {
//       if (!new_user_id || !reason) {
//         return sendResponse(res, 400, false, "new_user_id & reason required");
//       }

//       // 1️⃣ DELETE OLD ASSIGNMENT
//       const { error: deleteError } = await supabase
//         .from('task_assignments')
//         .delete()
//         .eq('task_id', task_id)
//         .eq('user_id', user_id);

//       if (deleteError) throw deleteError;

//       // 2️⃣ INSERT NEW ASSIGNMENT
//       const { error: insertError } = await supabase
//         .from('task_assignments')
//         .insert({
//           task_id,
//           user_id: new_user_id,
//           assigned_by: user_id,
//           assignment_status: 'pending'
//         });

//       if (insertError) throw insertError;

//       // 3️⃣ UPDATE TASK TABLE
//       await supabase
//         .from('tasks')
//         .update({
//           assigned_user_id: new_user_id,
//           assignment_status: 'pending',
//           reassignment_reason: reason
//         })
//         .eq('id', task_id);

//       return sendResponse(res, 200, true, "Task reassigned");
//     }

//   } catch (err) {
//     return sendResponse(
//       res,
//       500,
//       false,
//       "Error",
//       null,
//       { server: err.message }
//     );
//   }
// };

exports.handleTaskResponse = async (req, res) => {
  try {
    const supabase = req.supabase;

    const {
      task_id,
      action, // accept | decline | reassign
      new_user_id, // required for reassign
      reason
    } = req.body;

    const user_id = req.user.id;

    // =========================
    // ❌ VALIDATION
    // =========================
    if (!task_id || !action) {
      return sendResponse(res, 400, false, "task_id and action are required");
    }

    if (!['accept', 'decline', 'reassign'].includes(action)) {
      return sendResponse(res, 400, false, "Invalid action");
    }

    // =========================
    // ✅ ACCEPT TASK (RPC)
    // =========================
    if (action === 'accept') {
      const { error } = await supabase.rpc('accept_task_assignment', {
        p_task_id: task_id
      });

      if (error) throw error;

      return sendResponse(res, 200, true, "Task accepted successfully");
    }

    // =========================
    // ❌ DECLINE TASK (RPC)
    // =========================
    if (action === 'decline') {
      if (!reason || !reason.trim()) {
        return sendResponse(res, 400, false, "Decline reason is required");
      }

      const { error } = await supabase.rpc('decline_task_assignment', {
        p_task_id: task_id,
        p_decline_reason: reason.trim()
      });

      if (error) throw error;

      return sendResponse(res, 200, true, "Task declined successfully");
    }

    // =========================
    // 🔁 REASSIGN TASK
    // =========================
    if (action === 'reassign') {
    if (!new_user_id || !reason || !reason.trim()) {
      return sendResponse(res, 400, false, "new_user_id and reason are required");
    }

    // =========================
    // 1️⃣ DELETE CURRENT ASSIGNMENT
    // =========================
    const { error: deleteError } = await supabase
      .from('task_assignments')
      .delete()
      .eq('task_id', task_id)
      .eq('user_id', user_id);

    if (deleteError) throw deleteError;

    // =========================
    // 2️⃣ INSERT NEW ASSIGNMENT
    // =========================
    const { error: insertError } = await supabase
      .from('task_assignments')
      .insert({
        task_id,
        user_id: new_user_id,
        assigned_by: user_id,
        assignment_status: 'pending'
      });

    if (insertError) throw insertError;

    // =========================
    // 3️⃣ UPDATE TASK (REASON)
    // =========================
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        reassignment_reason: reason.trim()
      })
      .eq('id', task_id);

    if (updateError) throw updateError;

    return sendResponse(res, 200, true, "Task reassigned successfully");
  }

  } catch (err) {
    console.error("TASK RESPONSE ERROR:", err);

    return sendResponse(
      res,
      500,
      false,
      "Error",
      null,
      { server: err.message }
    );
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const supabase = req.supabase;
    const { task_id } = req.params;
    const { status } = req.body;

    // =========================
    // ❌ VALIDATION
    // =========================
    if (!task_id) {
      return sendResponse(res, 400, false, "task_id is required");
    }

    if (!status || !["todo", "complete"].includes(status)) {
      return sendResponse(res, 400, false, "Invalid status (todo | complete)");
    }

    // =========================
    // 📌 BUILD UPDATE OBJECT (ONLY REQUIRED FIELDS)
    // =========================
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === "complete") {
      updateData.completed_at = new Date().toISOString();
      updateData.position = 2;
    } else {
      updateData.completed_at = null;
      updateData.position = 6;
    }

    // =========================
    // 🔄 UPDATE TASK (SAFE)
    // =========================
    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", task_id)
      .select()
      .single();

    if (error) throw error;

    // =========================
    // ✅ RESPONSE
    // =========================
    return sendResponse(
      res,
      200,
      true,
      "Task status updated successfully",
      data
    );

  } catch (err) {
    return sendResponse(
      res,
      500,
      false,
      "Error updating task status",
      null,
      { server: err.message }
    );
  }
};

exports.filterTasks = async (req, res) => {
  try {
    const supabase = req.supabase;
    const user = req.user;
    const { org_id } = req.params;

    const {
      category,
      priority,
      due_type,
      start_date,
      end_date,
      assigned_to
    } = req.query;

    if (!org_id) {
      return sendResponse(res, 400, false, "org_id is required");
    }

    // =========================
    // 📌 BASE QUERY WITH ASSIGNMENTS
    // =========================
    let query = supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        priority,
        due_date,
        created_at,
        assigned_user_id,
        created_by_user_id,
        project_id,
        category,

        task_assignments (
          user_id,
          assignment_status
        )
      `)
      .eq("organization_id", org_id)
      .is("deleted_at", null);

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // =========================
    // 🎯 PRIORITY FILTER
    // =========================
    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }

    // =========================
    // 📅 DUE DATE FILTER
    // =========================
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (due_type && due_type !== "all") {
      if (due_type === "overdue") {
        query = query.lt("due_date", todayStr);
      }

      if (due_type === "today") {
        query = query.eq("due_date", todayStr);
      }

      if (due_type === "week") {
        const weekEnd = new Date();
        weekEnd.setDate(today.getDate() + 7);

        query = query
          .gte("due_date", todayStr)
          .lte("due_date", weekEnd.toISOString().split("T")[0]);
      }

      if (due_type === "month") {
        const monthEnd = new Date();
        monthEnd.setMonth(today.getMonth() + 1);

        query = query
          .gte("due_date", todayStr)
          .lte("due_date", monthEnd.toISOString().split("T")[0]);
      }

      if (due_type === "no_due") {
        query = query.is("due_date", null);
      }

      if (due_type === "custom" && start_date && end_date) {
        query = query
          .gte("due_date", start_date)
          .lte("due_date", end_date);
      }
    }

    // =========================
    // 🚀 EXECUTE QUERY
    // =========================
    const { data: tasks, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    // =========================
    // 🎯 APPLY ASSIGNMENT LOGIC (CRITICAL)
    // =========================
    let filteredTasks = tasks.filter(task => {
      const isOwner = task.created_by_user_id === user.id;

      if (isOwner) return true;

      const myAssignment = task.task_assignments?.find(
        a => a.user_id === user.id
      );

      if (!myAssignment) return false;

      return ['pending', 'accepted'].includes(myAssignment.assignment_status);
    });

    // =========================
    // 👤 ASSIGNED FILTER (UI MATCH)
    // =========================
    if (assigned_to && assigned_to !== "all") {
      if (assigned_to === "me") {
        filteredTasks = filteredTasks.filter(task => {
          const isDirect = task.assigned_user_id === user.id;
          const isAssigned = task.task_assignments?.some(
            a => a.user_id === user.id
          );
          return isDirect || isAssigned;
        });
      } else {
        filteredTasks = filteredTasks.filter(task => {
          const isDirect = task.assigned_user_id === assigned_to;
          const isAssigned = task.task_assignments?.some(
            a => a.user_id === assigned_to
          );
          return isDirect || isAssigned;
        });
      }
    }

    const taskIds = filteredTasks.map(t => t.id);

    // =========================
    // 📎 FETCH ATTACHMENTS
    // =========================
    const { data: attachments } = await supabase
      .from("task_attachments")
      .select("task_id, file_name, file_path")
      .in("task_id", taskIds);

    const attachmentsWithUrls = await Promise.all(
      (attachments || []).map(async (file) => {
        const { data } = await supabase.storage
          .from("task-attachments")
          .createSignedUrl(file.file_path, 3600);

        return {
          task_id: file.task_id,
          file_name: file.file_name,
          file_url: data?.signedUrl || null,
        };
      })
    );

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
    const formatted = filteredTasks.map(t => {
      const myAssignment = t.task_assignments?.find(
        a => a.user_id === user.id
      );

      return {
        ...t,
        assignment_status: myAssignment?.assignment_status || null,
        attachments: attachmentMap[t.id] || [],
        total_attachments: (attachmentMap[t.id] || []).length,
      };
    });

    return sendResponse(res, 200, true, "Filtered tasks", formatted);

  } catch (err) {
    return sendResponse(res, 500, false, "Error", null, {
      server: err.message,
    });
  }
};