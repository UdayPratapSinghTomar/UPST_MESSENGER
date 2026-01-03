const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/chat/activeUsersController');

router.get('/', auth, controller.getActiveUsers)

module.exports = router