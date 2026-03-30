const express = require('express');
const router = express.Router();
const controller = require('../controllers/individualTask/individualController');
const auth = require('../middlewares/middleware');

router.post('/create', auth, controller.createIndividualTask);
router.get('/fetch', auth, controller.getIndividualTasks);
router.patch('/update-status/:id', auth, controller.updateIndividualTaskStatus);

module.exports = router;