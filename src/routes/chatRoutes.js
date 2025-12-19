const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const chatController = require('../controllers/chat/chatController');

// private chat
router.post('/private', auth, chatController.createPrivateChat);

// group chat
router.post('/group', auth, chatController.createGroup)
router.post('/group/add-user', auth, chatController.addGroupMember)
router.post('/group/remove-user', auth, chatController.removeGroupMember)

// router.get('/', auth, chatController.gerUserChats);

module.exports = router;
