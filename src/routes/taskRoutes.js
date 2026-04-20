const express = require('express');
const cors = require('cors');

const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTasksByAssignmentStatus,
  markTaskAssignmentAccepted,
  getTasksByStatus,
  getTaskByIdAndStatus,
  markTaskCompleted
} = require('../controllers/tasks/taskController');

const router = express.Router();

// Create
router.post('/create', createTask);

// Status-based routes (put BEFORE /:id to avoid conflicts)
router.get('/assignment-status/:assignment_status', getTasksByAssignmentStatus);
router.get('/task-status/:status', getTasksByStatus);

// Special actions
router.patch('/:id/accepted', markTaskAssignmentAccepted);
router.patch('/:id/complete', markTaskCompleted);

// Details route (more specific than /:id)
router.get('/:id/details', getTaskByIdAndStatus);

// General routes
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;