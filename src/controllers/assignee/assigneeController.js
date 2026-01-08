const { Assignee } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response');

exports.fetchAssignee = async (req, res) => {
    try{
        const assignees = await Assignee.findAll();
        return sendResponse(res, HttpsStatus.OK, true, "Assignee fetch successfully!", assignees);
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, err.message);
    }
}