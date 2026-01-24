const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/assignee/assigneeController');

router.get('/fetch', auth, controller.assignee);

module.exports = router;