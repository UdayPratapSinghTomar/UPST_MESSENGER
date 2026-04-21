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

    let { status, category } = req.query;
    let { org_id } = req.params;

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
        category,
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
        *
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
      category: t.category,
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
        *
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

exports.handleTaskResponse = async (req, res) => {
  try {
    const supabase = req.supabase;

    const {
      task_id,
      action, // accept | decline | reassign
      user_id, // current user
      new_user_id, // only for reassign
      reason
    } = req.body;

    if (!task_id || !action || !user_id) {
      return sendResponse(res, 400, false, "task_id, action, user_id required");
    }

    // =========================
    // 📌 VALID ACTION
    // =========================
    if (!['accept', 'decline', 'reassign'].includes(action)) {
      return sendResponse(res, 400, false, "Invalid action");
    }

    // =========================
    // 📌 ACCEPT TASK
    // =========================
    if (action === 'accept') {
      const { error } = await supabase
        .from('task_assignments')
        .update({
          assignment_status: 'accepted',
          accepted_at: new Date().toISOString(),
          decline_reason: null
        })
        .eq('task_id', task_id)
        .eq('user_id', user_id);

      if (error) throw error;

      await supabase
        .from('tasks')
        .update({
          assignment_status: 'accepted'
        })
        .eq('id', task_id);

      return sendResponse(res, 200, true, "Task accepted");
    }

    // =========================
    // 📌 DECLINE TASK
    // =========================
    if (action === 'decline') {
      if (!reason) {
        return sendResponse(res, 400, false, "Decline reason required");
      }

      const { error } = await supabase
        .from('task_assignments')
        .update({
          assignment_status: 'declined',
          declined_at: new Date().toISOString(),
          decline_reason: reason
        })
        .eq('task_id', task_id)
        .eq('user_id', user_id);

      if (error) throw error;

      await supabase
        .from('tasks')
        .update({
          assignment_status: 'declined',
          decline_reason: reason
        })
        .eq('id', task_id);

      return sendResponse(res, 200, true, "Task declined");
    }

    // =========================
    // 📌 REASSIGN TASK
    // =========================
    if (action === 'reassign') {
      if (!new_user_id || !reason) {
        return sendResponse(res, 400, false, "new_user_id & reason required");
      }

      // 1️⃣ DELETE OLD ASSIGNMENT
      const { error: deleteError } = await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', task_id)
        .eq('user_id', user_id);

      if (deleteError) throw deleteError;

      // 2️⃣ INSERT NEW ASSIGNMENT
      const { error: insertError } = await supabase
        .from('task_assignments')
        .insert({
          task_id,
          user_id: new_user_id,
          assigned_by: user_id,
          assignment_status: 'pending'
        });

      if (insertError) throw insertError;

      // 3️⃣ UPDATE TASK TABLE
      await supabase
        .from('tasks')
        .update({
          assigned_user_id: new_user_id,
          assignment_status: 'pending',
          reassignment_reason: reason
        })
        .eq('id', task_id);

      return sendResponse(res, 200, true, "Task reassigned");
    }

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

exports.updateTaskStatus = async (req, res) => {
  try {
    const supabase = req.supabase;
    const user = req.user; // assuming auth middleware

    const { task_id } = req.params;
    const { status } = req.body;

    // =========================
    // ❌ VALIDATIONS
    // =========================
    if (!task_id) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "task_id is required");
    }

    if (!status || !["todo", "complete"].includes(status)) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Invalid status (todo | complete)");
    }

    // =========================
    // 📌 PREPARE UPDATE DATA
    // =========================
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    // if marking complete → set completed_at
    if (status === "complete") {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    // =========================
    // 🔄 UPDATE TASK
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
      HttpsStatus.OK,
      true,
      "Task status updated successfully",
      data
    );

  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
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

    const {
      org_id,
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
    // 📌 BASE QUERY
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
        project_id
      `)
      .eq("organization_id", org_id)
      .is("deleted_at", null);

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
    // 👤 ASSIGNED FILTER
    // =========================
    if (assigned_to && assigned_to !== "all") {
      if (assigned_to === "me") {
        query = query.eq("assigned_user_id", user.id);
      } else {
        query = query.eq("assigned_user_id", assigned_to);
      }
    }

    // =========================
    // 🚀 EXECUTE QUERY
    // =========================
    const { data: tasks, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    const taskIds = tasks.map(t => t.id);

    // =========================
    // 📎 FETCH ATTACHMENTS
    // =========================
    const { data: attachments } = await supabase
      .from("task_attachments")
      .select("task_id, file_name, file_path")
      .in("task_id", taskIds);

    // 🔥 SIGNED URL
    const attachmentsWithUrls = await Promise.all(
      (attachments || []).map(async (file) => {
        const { data, error } = await supabase.storage
          .from("task-attachments")
          .createSignedUrl(file.file_path, 3600);

        return {
          file_name: file.file_name,
          file_url: error ? null : data?.signedUrl,
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
    const formatted = tasks.map(t => ({
      ...t,
      attachments: attachmentMap[t.id] || [],
      total_attachments: (attachmentMap[t.id] || []).length,
    }));

    return sendResponse(res, 200, true, "Filtered tasks", formatted);

  } catch (err) {
    return sendResponse(res, 500, false, "Error", null, {
      server: err.message,
    });
  }
};