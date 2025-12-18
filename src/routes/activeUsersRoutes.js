const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const activeUsersController = require('../controllers/chat/activeUsersController');

router.get('/', auth, activeUsersController.getActiveUsers)

module.exports = router