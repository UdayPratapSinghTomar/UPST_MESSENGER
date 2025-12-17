const router = require('express').Router()
const auth = require('../middlewares/authMiddleware')
const controller = require('../controllers/notification/notificationController');

router.post('/save-token', auth, controller.saveFcmToken)

module.exports = router
