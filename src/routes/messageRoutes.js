const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/message/messageController');
const upload = require('../utils/multer');

router.post('/send', auth, upload.any(), controller.sendMessage);
router.post('/edit/:message_id', auth, upload.any(), controller.editMessage);
router.post('/delete/:message_id', auth, upload.any(), controller.deleteMessage);
// router.post('/delivered', auth, controller.deliveredMessage);
// router.post('/read', auth, controller.readMessage);
router.post('/forward', auth, controller.forwardMessage);
// router.post('/mention-user', auth, controller.mentionUser);
// router.get('/', auth, controller.gerUserChats);

module.exports = router;
