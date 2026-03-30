const express = require('express');
const router = express.Router();
const controller = require('../controllers/individualTask/individualController');
const auth = require('../middlewares/middleware');

router.post('/create', auth, controller.individualTaskCreate);
router.get('/fetch', auth, controller.getIndividualTasks);

module.exports = router;