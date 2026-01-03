const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/project/projectController');

router.post('create', auth, controller.createProject);

module.exports = router;
