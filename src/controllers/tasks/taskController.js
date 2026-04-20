const express = require("express");

const {supabase, supabaseAdmin} = require('../../config/database');

// Create Task
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      icon,
      priority,
      subcategory,
      project,
      due_date,
      assigned_to,
      recurring,
      attachments,
      urls,
      status,
      assignment_status
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        title,
        description,
        icon,
        priority,
        subcategory,
        project,
        due_date,
        assigned_to,
        recurring,
        attachments,
        urls,
        status: status || 'todo',
        assignment_status: assignment_status || 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, message:"Task created successfully", data });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Get all tasks
const getTasks = async (req, res) => {
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
const getTaskById = async (req, res) => {
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
const updateTask = async (req, res) => {
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
const deleteTask = async (req, res) => {
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
const getTasksByStatus = async (req, res) => {
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
const getTaskByIdAndStatus = async (req, res) => {
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
const markTaskCompleted = async (req, res) => {
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
const getTasksByAssignmentStatus = async (req, res) => {
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
const markTaskAssignmentAccepted = async (req, res) => {
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


module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTasksByStatus,
  getTaskByIdAndStatus,
  markTaskCompleted,
  getTasksByAssignmentStatus,
  markTaskAssignmentAccepted
};