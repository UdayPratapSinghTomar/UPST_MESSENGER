const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/message/messageController');
const upload = require('../utils/multer');

router.post('/send', auth, upload.any(), controller.sendMessage);
router.post('/delivered', auth, controller.deliveredMessage);
router.post('/read', auth, controller.readMessage);
router.get('/:chat_id', auth, controller.fetchMessages);

// router.get('/', auth, controller.gerUserChats);

module.exports = router;
