const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth/authController');
const auth = require('../middlewares/authMiddleware');
const upload = require('../utils/multer');

router.post('/login', controller.login);
// router.post('/refresh', controller.refreshToken);
router.post('/admin-register',  controller.adminRegister);
router.post('/user-register',  controller.userRegister);
router.post('/logout', auth, controller.logout);
router.post('/logout-all', auth, controller.logoutFromAllDevice);
router.post('/verify-email', controller.requestPasswordOtp);
router.post('/verify-otp', controller.verifyOtp);
router.post('/reset-password', controller.resetPassword);

module.exports = router;