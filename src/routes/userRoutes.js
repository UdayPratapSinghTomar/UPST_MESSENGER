const express = require('express');
const router = express.Router();
const controller = require('../controllers/user/userController');
const { authenticationJWT } = require('../middlewares/authMiddleware');

router.post('/fetch-organization-users', controller.fetchUsersByOrgId);

module.exports = router;