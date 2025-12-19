const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const chatController = require('../controllers/message/messageController');

router.post('/', auth, chatController.sendMessage);
router.get('/:chat_id', auth, chatController.getMessages);

// router.get('/', auth, chatController.gerUserChats);

module.exports = router;
