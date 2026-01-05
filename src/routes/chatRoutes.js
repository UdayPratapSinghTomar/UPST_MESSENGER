const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/chat/chatController');

// private chat
router.post('/create-private', auth, controller.createPrivateChat);

// group chat
router.post('/create-group', auth, controller.createGroup)
router.post('/group/add-user', auth, controller.addGroupMember)
router.post('/group/remove-user', auth, controller.removeGroupMember)

// open chat
router.post('/:chat_id', auth, controller.openChat);

// active users
router.get('/', auth, controller.getActiveUsers);

// user chat list
router.get('/', auth, controller.getChatList);

// router.get('/', auth, controller.gerUserChats);

module.exports = router;
