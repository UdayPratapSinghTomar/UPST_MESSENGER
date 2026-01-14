const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth/authController');
const { authenticationJWT } = require('../middlewares/authMiddleware');

router.post('/login', controller.login);
// router.post('/refresh', controller.refreshToken);
router.post('/admin-register',  controller.adminRegister);
router.post('/user-register',  controller.userRegister);
router.post('/logout', controller.logout);
router.post('/forget-password', controller.forgetPassword);

module.exports = router;