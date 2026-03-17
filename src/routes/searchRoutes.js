const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/search/searchController');

router.get('/all', auth, controller.searchAll);
router.get('/chat-messages/:chat_id/', auth, controller.searchChatMessages)
router.get('/user', auth, controller.searchUsers)

module.exports = router;