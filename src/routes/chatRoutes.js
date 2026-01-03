const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/chat/chatController');

// private chat
router.post('/private', auth, controller.createPrivateChat);

// group chat
router.post('/group', auth, controller.createGroup)
router.post('/group/add-user', auth, controller.addGroupMember)
router.post('/group/remove-user', auth, controller.removeGroupMember)

// open chat
router.post('/:chat_id', auth, controller.openChat);

// router.get('/', auth, controller.gerUserChats);

module.exports = router;
