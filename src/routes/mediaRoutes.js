const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const upload = require('../utils/multer');
const controller = require('../controllers/media/mediaController');

router.post('/upload', auth, upload.single('file'), controller.uploadFile);

module.exports = router;