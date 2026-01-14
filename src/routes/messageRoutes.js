const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/message/messageController');
const upload = require('../utils/upload');

router.post('/send', auth, upload.fields([
    { name: 'file', maxCount:1 },
    { name: 'video', maxCount:1 },
    { name: 'audio', maxCount:1 }
]), controller.sendMessage);
router.get('/:chat_id', auth, controller.fetchMessages);

// router.get('/', auth, controller.gerUserChats);

module.exports = router;
