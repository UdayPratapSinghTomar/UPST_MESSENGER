const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/chat/chatController');

// private chat
router.post('/create-private', auth, controller.createPrivateChat);

// group chat
router.post('/create-group', auth, controller.createGroup)
router.post('/add-group-member', auth, controller.addGroupMember)
router.post('/remove-group-member', auth, controller.removeGroupMember)

// open chat
router.get('/open/:chat_id', auth, controller.openChat);

// user chat list
router.get('/chat-list', auth, controller.chatList);
router.get('/private-chats', auth, controller.allPrivateChats);
router.get('/group-chats', auth, controller.allGroupChats);

// router.get('/', auth, controller.gerUserChats);
// chats history
router.get('/private-chat-history/:chat_id', auth, controller.chatHistory);
router.get('/group-details/:chat_id', auth, controller.groupDetails);
module.exports = router;
