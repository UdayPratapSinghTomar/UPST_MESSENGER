const { Priorities } = require('../../models');
const { sendResponse, HttpsStatus } = require('../../utils/response');

exports.createPriorities = async (req, res) => {
    try{
        const { name } = req.body;

        if(!name){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Name is required!');
        }

        const priorities = await Priorities.findAll({ where: { name } });

        if(priorities){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Priority already present!');
        }

        const data = await Priorities.create({
            name
        });

        return sendResponse(res, HttpsStatus.CREATED, true, 'Priorities created', data);

    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
    }
}

exports.fetchPriorities = async (req, res) => {
    try{
        const priorities = await Priorities.findAll({
            attributes: ['id', 'name'],
        });

        return sendResponse(res, HttpsStatus.OK, true, 'Priorities retreived successfully!', priorities);
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
    }
}