const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendResponse, HttpsStatus } = require('../../utils/response');
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

exports.getProjects = async (req, res) => {
  try {
    const supabase = req.supabase; // ✅ RLS client
    const { org_id } = req.body;

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
    const { org_id } = req.body;

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

// Get all tasks
exports.getTasks = async (req, res) => {
  try {
    const { status, assignment_status } = req.query;

    let query = supabase.from('tasks').select('*')
      .order('created_at', { ascending: false });

      console.log("hnsjhfsd",query)

    if (status) query = query.eq('status', status);
    if (assignment_status) query = query.eq('assignment_status', assignment_status);

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true,  message:"Task Retrieve Successfully", data });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Get single task
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json({ success: true, message:"Task Retrieve Successfully", data });

  } catch (err) {
    res.status(404).json({ success: false, message: 'Task not found' });
  }
};


// Update task
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.body.status && !['todo', 'completed'].includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message:"Task Updated Successfully", data });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Task deleted successfully' });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Get tasks by status
exports.getTasksByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    if (!['todo', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', status);

    if (error) throw error;

    res.json({ success: true, message:"Task Retrieve Successfully", data });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Get task with details
exports.getTaskByIdAndStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    let query = supabase
      .from('tasks')
      .select(`
        *,
        projects ( id, name ),
        task_assignees ( user_id )
      `)
      .eq('id', id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.single();

    if (error) throw error;

    res.json({ success: true, message:"Task Retrieve Successfully", data });

  } catch (err) {
    res.status(404).json({ success: false, message: 'Task not found' });
  }
};


// Mark task completed
exports.markTaskCompleted = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date()
      })
      .eq('id', id)
      .eq('status', 'todo')
      .select();

    if (error) throw error;

    if (!data.length) {
      return res.status(400).json({
        success: false,
        message: 'Task already completed or not found'
      });
    }

    res.json({
      success: true,
      message: 'Task marked as completed',
      data
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Get tasks by assignment status
exports.getTasksByAssignmentStatus = async (req, res) => {
  try {
    const { assignment_status } = req.params;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assignment_status', assignment_status);

    if (error) throw error;

    res.json({ success: true, message:"Task Retrieve Successfully", data });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Mark assignment accepted
exports.markTaskAssignmentAccepted = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('tasks')
      .update({
        assignment_status: 'accepted'
      })
      .eq('id', id)
      .eq('assignment_status', 'pending')
      .select();

    if (error) throw error;

    if (!data.length) {
      return res.status(400).json({
        success: false,
        message: 'Already accepted or task not found'
      });
    }

    res.json({
      success: true,
      message: 'Assignment accepted',
      data
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
