const express = require("express");
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const chatController = require('../controllers/chat/chatController');

router.post("/private", auth, chatController.createPrivateChat);
router.post("/message", auth, chatController.sendMessage);
router.get("/message/:chat_id", auth, chatController.getMessages);

// router.get("/", auth, chatController.gerUserChats);

module.exports = router;
