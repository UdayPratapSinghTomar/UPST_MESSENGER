const { User } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response');

exports.saveFcmToken = async (req, res) => {
    try{
        const { fcmToken } = req.body;
    
        await User.update(
            { fcmToken },
            { where: { id: req.user.id }}
        );

        return sendResponse(res, HttpsStatus.OK, true, 'Token saved!');
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
    }
}