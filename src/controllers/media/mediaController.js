const express = require('express');
const { sendResponse, HttpsStatus } = require('../../utils/response');

exports.uploadFile = async (req, res) => {
    try{
        if(!req.file)
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'No file uploaded');

        const file_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        const file_type = 'file';
        if (req.file.mimetype.startsWith('image')) fileType = 'image';
        if (req.file.mimetype.startsWith('video')) fileType = 'video';
        if (req.file.mimetype.startsWith('audio')) fileType = 'voice';

        const responseData = {
            file_url,
            file_name: req.file.originalname,
            file_type,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            duration: null,
            thumbnail_url: null
        }

        return sendResponse(res, HttpsStatus.OK, true, 'File uploaded successfully!', responseData);
    }catch(err){
        console.log("err---", err);
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.msg);
    }
}