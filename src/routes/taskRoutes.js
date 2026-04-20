const express = require('express');
const router = express.Router();
const controller = require('../controllers/tasks/taskController');
const auth = require('../middlewares/authMiddleware');
const { uploadImage, upload } = require('../utils/multer');

router.post('/create', auth, upload.any(), controller.createTask);
router.get('/get-projects', auth, controller.getProjects);
router.get('/get-assignees', auth, controller.getAssignees);

router.post('/check-connection', controller.testconnection);

module.exports = router;