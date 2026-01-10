const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/message/messageController');

router.post('/send', auth, controller.sendMessage);
router.get('/:chat_id', auth, controller.fetchMessages);

// router.get('/', auth, controller.gerUserChats);

module.exports = router;
