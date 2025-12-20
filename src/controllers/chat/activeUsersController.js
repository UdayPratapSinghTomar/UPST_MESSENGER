const { User } = require('../../models');
const { getOnlineUsers } = require('../../utils/onlineUsersRedis');
const { sendResponse, HttpsStatus } = require('../../utils/response');

exports.getActiveUsers = async (req, res) => {
    try{
        const currentUserId = req.user.id;
        const onlineUserIds = await getOnlineUsers();
        // console.log('onlineUserIds***********',onlineUserIds)

        const users = await User.findAll({
            where: {
                id: onlineUserIds.filter(id => id !== currentUserId)
            },
            attributes: ['id', 'full_name', 'profile_url']
        });

        return sendResponse(res, HttpsStatus.OK, true, 'Online users!', users);
    }catch(err){
        console.log(err);
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
    }
}