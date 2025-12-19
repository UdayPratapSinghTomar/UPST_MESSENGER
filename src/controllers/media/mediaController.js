const express = require('express');
const { sendResponse, HttpsStatus } = require('../../utils/response');

exports.uploadFile = async (req, res) => {
    try{
        if(!req.file)
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'No file uploaded');

        const file_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        return sendResponse(res, HttpsStatus.OK, true, 'File uploaded successfully!', res.json({ file_url, fileType: req.file.mimetype }));
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.msg);
    }
}