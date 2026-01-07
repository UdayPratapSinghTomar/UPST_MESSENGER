const { ProductManage, ActivityLog, APIUsedTable, sequelize } = require('../../models');
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
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Missing fields!", null, errors);
        }

        const t = await sequelize.transaction();
        try{
            const product = await ProductManage.create({
                title,
                description,
                status,
                org_id,
                deadline,
                label,
                assignees
            });
            
        }catch(err){
            await t.rollback();
            return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, err.message);
        }
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, err.message);
    }
}