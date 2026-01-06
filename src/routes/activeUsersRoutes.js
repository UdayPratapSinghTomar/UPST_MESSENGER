const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/activeUser/activeUsersController');

// active users
router.get('/', auth, controller.getActiveUsers);

module.exports = router