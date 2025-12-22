const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const searchController = require('../controllers/search/searchController');


router.get('/', auth, searchController.searchAll);
router.get('/messages/:chat_id/', auth, searchController.searchChatMessages)

module.exports = router;