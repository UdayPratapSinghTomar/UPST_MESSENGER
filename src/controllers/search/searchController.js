const { User, Chat, ChatMember, Message, SharedFile } = require('../../models');
const { Op } = require('sequelize');
const { sendResponse, HttpsStatus } = require('../../utils/response');

exports.searchAll = async (req, res) => {
    try{
        const user_id = req.user.id;
        const { q } = req.query;

        if(!q){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Search bar is empty!', { users: [], groups: [], messages: [] });
        }

        const users = await User.findAll({
            where: {
                id: { [Op.ne]: user_id},
                full_name: { [Op.iLike]: `%${q}`}
            },
            attributes: ['id', 'full_name', 'profile_url'],
            limit: 10
        });

        const privateChats = await Chat.findAll({
            where: {
                type: 'private',
                is_deleted: false
            },
            include: [
                {
                    model: ChatMember,
                    as: 'memberships',
                    where: {
                        user_id: user_id
                    },
                    attributes: [],
                    required: true
                },
                {
                    model: ChatMember,
                    as: 'memberships',
                    required: true,
                    where: {
                        user_id: { [Op.ne]: user_id }
                    },
                    attributes: [],
                    include: [
                        {
                        model: User,
                        as: 'user',
                        where: {
                            full_name: { [Op.iLike]: `%${q}%` }
                        },
                        attributes: ['id', 'full_name', 'profile_url']
                        }
                    ]
                }
            ],
            attributes: ['id', 'type'],
            limit: 10,
            subQuery: false 
        });


        const groups = await Chat.findAll({
            where: {
                type: 'group',
                group_name: { [Op.iLike]: `%${q}` },
                is_deleted: false
            },
            include: [
                {
                    model: ChatMember,
                    as: 'memberships',
                    where: { user_id: user_id },
                    attributes: []
                }
            ],
            attributes: ['id', 'group_name', 'group_image'],
            limit: 10
        })

        const messages = await Message.findAll({
            where: {
                content: { [Op.iLike]: `%${q}` }
            },
            include: [ 
                {
                    model: Chat,
                    as: 'chat',
                    attributes: ['id', 'type', 'group_name'],
                    where: { is_deleted: false },
                    include: [
                        {
                            model: ChatMember,
                            as: 'memberships',
                            where: { user_id: user_id },
                            attributes: []
                        }
                    ]
                },
                {
                   model: User,
                   as: 'sender',
                   attributes: ['id', 'full_name'] 
                }
            ],
            attributes: ['id', 'content', 'created_at'],
            order: [['created_at', 'DESC']],
            limit: 20
        });
        return sendResponse(res, HttpsStatus.OK, true, 'Data retrieve successfully!', { users, privateChats, groups, messages } );
    }catch(err){
        // console.log("search error ------- ", err);
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.messages);
    }
}

exports.searchChatMessages = async (req, res) => {
    try{
        const { chat_id } = req.params;
        const { q } = req.query;

        const messages = await Message.findAll({
            where : {
                chat_id,
                [Op.or]:[
                    {
                        content: { [Op.iLike]: `%${q}` }
                    },
                    {
                        '$files.file_name$' : { [Op.iLike]: `%${q}` }
                    }
                ]
            },
            include: [
                {
                    model: SharedFile,
                    as: 'files',
                    required: false
                }
            ],
            distinct: true
        });

        return sendResponse(res, HttpsStatus.OK, true, "Chat retrieved successfully!", messages);
    }catch(err){
        console.log("error", err);
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, err.message);
    }
}