const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

const uploadImage = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'image/png',
            'image/jpeg', // covers jpg + jpeg
        ];

        const allowedExtensions = ['.png', '.jpg', '.jpeg'];

        const ext = path.extname(file.originalname).toLowerCase();

        if (
            allowedMimeTypes.includes(file.mimetype) &&
            allowedExtensions.includes(ext)
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only PNG and JPG images are allowed!'), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 5MB
    }
});

module.exports = { upload, uploadImage };