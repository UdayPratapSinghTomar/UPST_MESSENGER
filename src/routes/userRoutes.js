const express = require('express');
const router = express.Router();
const controller = require('../controllers/user/userController');
const { authenticationJWT } = require('../middlewares/authMiddleware');
const upload = require('../utils/multer');

router.post('/fetch-organization-users', controller.fetchUsersByOrgId);
router.put('/update-profile', upload.single('file'), controller.updateProfile);
module.exports = router;