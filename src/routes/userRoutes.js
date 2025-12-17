const express = require('express');
const router = express.Router();
const authController = require('../controllers/user/userController');
const { authenticationJWT } = require('../middlewares/authMiddleware');

router.post('/login', authController.login);
// router.post('/refresh', authController.refreshToken);
router.post('/register',  authController.register);
router.post('/logout', authController.logout);
router.post('/forget-password', authController.forgetPassword);

module.exports = router;