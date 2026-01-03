const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/priorities/prioritiesController');


router.post('/create', auth, controller.createPriorities);

module.exports = router;