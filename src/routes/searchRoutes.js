const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/search/searchController');


router.get('/', auth, controller.searchAll);
router.get('/messages/:chat_id/', auth, controller.searchChatMessages)

module.exports = router;