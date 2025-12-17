const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const upload = require('../utils/upload');
const mediaController = require('../controllers/media/mediaController');

router.post('/upload', auth, upload.single('file'), mediaController.uploadFile);

module.exports = router;