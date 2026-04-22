const express = require('express');
const router = express.Router();
const controller = require('../controllers/tasks/taskController');
const auth = require('../middlewares/authMiddleware');
const { uploadImage, upload } = require('../utils/multer');

router.post('/create', auth, upload.any(), controller.createTask);
router.get('/lists/:org_id', auth, controller.getTasksByStatus);
router.get('/details/:task_id', auth, controller.getTaskDetails);
router.get('/pending/:org_id', auth, controller.getPendingTaskRequests);
router.get('/filter/:org_id', auth, controller.filterTasks);

router.patch('/update/:task_id', auth, upload.any(), controller.updateTask);
router.patch('/status-update/:task_id', auth, controller.updateTaskStatus);
router.post('/assignment-action', auth, controller.handleTaskResponse);
router.post('/get-dynamic-url', auth, controller.getMultipleSignedUrls);

router.delete('/attachment/:attachment_id', auth, controller.deleteTaskAttachment)

router.post('/check-connection', controller.testconnection);
const cors = require('cors');

// const router = express.Router();


// Status-based routes (put BEFORE /:id to avoid conflicts)
// router.get('/assignment-status/:assignment_status', controller.getTasksByAssignmentStatus);
// router.get('/task-status/:status', controller.getTasksByStatus);

// // Special actions
// router.patch('/:id/accepted', controller.markTaskAssignmentAccepted);
// router.patch('/:id/complete', controller.markTaskCompleted);

// // Details route (more specific than /:id)
// router.get('/:id/details', controller.getTaskByIdAndStatus);

// // General routes
// router.get('/', controller.getTasks);
// router.get('/:id', controller.getTaskById);
// router.put('/:id', controller.updateTask);
// router.delete('/:id', controller.deleteTask);

module.exports = router;