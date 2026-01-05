const { ProductManage, ActivityLog, APIUsedTable } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response');

exports.createProject = async (req, res) => {
    try{
        const { 
            title,
            description,
            status,
            organization_id,
            admin_id,
            deadline,
            label,
            assignees
        } = req.body ;

        let errors = {};
        if(!title){
            errors.title = "Title is required";
        }

        if(!status){
            errors.status = "Status is required";
        }

        if(Object.keys(errors).length > 0){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Validation failed!", null, errors);
        }
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, err.message);
    }
}