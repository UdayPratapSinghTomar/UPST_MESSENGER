const express = require('express');
const router = express.Router();
const controller = require('../controllers/user/userController');
const auth = require('../middlewares/authMiddleware');
const upload = require('../utils/multer');

router.get('/fetch-organization-users', auth, controller.usersByOrgId);
router.get('/active-users', auth, controller.activeUsers);
router.put('/update-profile', upload.single('file'), controller.updateProfile);
module.exports = router;