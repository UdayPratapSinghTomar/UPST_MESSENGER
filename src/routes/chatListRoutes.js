const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const chatListController = require('../controllers/chat/chatListController');

router.get('/', auth, chatListController.getChatList)

module.exports = router