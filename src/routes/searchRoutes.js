const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const searchController = require('../controllers/search/searchController');


router.get('/', auth, searchController.searchAll);

module.exports = router;