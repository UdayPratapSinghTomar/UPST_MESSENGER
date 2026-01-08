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
            assignees,
            user_type,
            location
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
            const project = await ProductManage.create({
                title,
                description,
                status,
                org_id,
                deadline,
                label,
                assignees
            }, 
            {
                transaction: t
            });
            
            const apiUsedTable = await APIUsedTable.create({
                organization_id,
                table_name: 'product_manage',
                feature: 'Project Creation'
            },
            { 
                transaction: t 
            });

            const logQuery = await ActivityLog.create({
                user_id: admin_id,
                user_type: user_type || 'admin',
                action_type: 'create',
                module: 'project',
                description: `Created new project titled "${title}"`,
                new_data: JSON.stringify(project),
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                agent: req.headers['user-agent'] || '',
                location: location || null
            },
            {
                transaction: t
            });

            await t.commit();

            return sendResponse(res, HttpsStatus.CREATED, true, "Project created!", project);
        }catch(err){
            await t.rollback();
            return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, err.message);
        }
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, err.message);
    }
}