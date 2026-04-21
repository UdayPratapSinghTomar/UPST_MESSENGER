const express = require('express');
const router = express.Router();
const controller = require('../controllers/user/userController');
const auth = require('../middlewares/authMiddleware');
const { uploadImage } = require('../utils/multer');

router.get('/fetch-organization-users', auth, controller.usersByOrgId);
router.get('/active-users', auth, controller.activeUsers);
router.put('/update-profile', auth, uploadImage.single('file'), controller.updateProfile);
router.put('/update-group-profile', auth, uploadImage.single('file'), controller.updateGroupProfile);
router.get('/fetch-profile/:user_id', auth, controller.fetchProfile);
router.get('/fetch-group-profile/:chat_id', auth, controller.fetchGroupProfile);
router.get('/assignees/:org_id', auth, controller.getAssignees);
module.exports = router;