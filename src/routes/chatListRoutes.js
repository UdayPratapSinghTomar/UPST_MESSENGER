const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/chat/chatListController');

router.get('/', auth, controller.getChatList)

module.exports = router