const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const { Op } = require('sequelize');

exports.fetchUsersByOrgId = async (req, res) => {
    try{
        const orgId = req.body.org_id;

        if(!orgId){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Organization is is required!');
        }

        const organizationUsers = await User.findAll({
            where:  { is_deleted: false, 
                [Op.or]: [
                    { organization_id: orgId },
                    { org_2: orgId },
                    { org_3: orgId },
                    { org_4: orgId },
                    { org_5: orgId },
                    { org_6: orgId },
                    { org_7: orgId },
                    { org_8: orgId },
                    { org_9: orgId },
                    { org_10: orgId },
                ]}
        });

        return sendResponse(res, HttpsStatus.OK, true, 'Organization users retreive successfully!', organizationUsers);
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, err.message);
    }
}