const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const { generateAccessToken, generateRefreshToken, expiryDateFromNow} = require('../../utils/tokens');

const { User, RefreshToken, Organization, sequelize } = require('../../models');
const { verifyRefreshToken } = require('../../utils/tokens');
const { SequelizeScopeError } = require('sequelize');

// exports.refreshToken = async (req, res) =>{
//     try{
//         const { refreshToken } = req.body;
//         if(!refreshToken){
//             return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Refresh token required', null, { refreshToken: 'Missing' });
//         }

//         let payload;
//         try{
//             payload = verifyRefreshToken(refreshToken);
//         }catch(err){
//             return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Invalid refresh token', null, { refreshToken: 'Invalid or expired' });
//         }

//         const stored = await RefreshToken.findOne({ where: { user_id: payload.id, token: refreshToken }});
//         if(!stored){
//             return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Refresh token not recognized', null, { refreshToken: 'Not found' });
//         }

//         if(stored.expires_at && new Date(stored.expires_at) < new Date()){
//             await RefreshToken.destroy({ where: { id: stored.id }});
//             return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Refresh token expired', null, { refreshToken: 'Expired' });
//         }

//         const user = await User.findByPk(payload.id);
//         if(!user){
//             return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'User not found', null, { user: 'Not found' });
//         }

//         const newAccessToken = generateAccessToken({ id: user.id, email: user.email });
//         const newRefreshToken = generateRefreshToken({ id: user.id, email: user.email });

//         await RefreshToken.update({ token: newRefreshToken, expires_at: expiryDateFromNow()}, { where: {id: stored.id }});

//         return sendResponse(res, HttpsStatus.OK, true, 'Token refreshed', { accessToken: newAccessToken, refreshToken: newRefreshToken });
//     }catch(err){
//         console.error('refreshToken error:', err);
//         return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error', null, { server: { server: err.message } });
//         }
// }

exports.register = async (req,res) => {
    try{
        const {
            organization_name,
            employee_size,
            website,
            full_name,
            job_role,
            phone,
            email,
            password
        } = req.body;

        const errors = {};

        if(!organization_name){
            errors.organization_name = 'Organization name is required';
        }
        if(!employee_size){
            errors.employee_size = 'Employee size is required';
        }
        if(!full_name){
            errors.full_name = 'Full name is required';
        }
        if(!job_role){
            errors.job_role = 'Job role is required';
        }
        if(!email){
            errors.email = 'Email is required';
        }
        if(!password){
            errors.password = 'Password is required';
        }

        if(Object.keys(errors).length > 0){
           return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Missing fields', null, errors);
        }

        const existingEmail = await User.findOne({ where: { email } });  
        if(existingEmail){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Email already exists!');
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const t = await sequelize.transaction();
        try{
            const organization = await Organization.create({'name': organization_name, employee_size, website }, { transaction: t })

            const user = await User.create({
                                        full_name,
                                        email,
                                        phone,
                                        'password': hashedPassword,
                                        'organization_id': organization.id,
                                        'designation': job_role
                                    }, 
                                    { transaction: t});
            
            await t.commit();
            return sendResponse(res, HttpsStatus.CREATED, true, 'User created successfully!',user); 
        }catch(err){
            await t.rollback();
            return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
        }                     
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
    } 
}

exports.login = async (req, res) => {
    try{
        const { email, password } = req.body
        const errors = {};
        
        if(!email){
           errors.email = 'Email is required';
        }
        if(!password){
            errors.password = 'Password is required';
        }

        if(Object.keys(errors).length > 0){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Validation failed!', null, errors);
        }

        const user = await User.findUserByEmail(email);
        if(!user){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Invalid credentials!', null, {email: 'User not found'});
        }

        let matchPassword = await bcrypt.compare(password, user.password);
        if(!matchPassword){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Invalid credentials!', null, {email: 'Wrong password'});
        }

        const payload = {id: user.id, email: user.email};

        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);
    
        const t = await sequelize.transaction();
        try{
            await RefreshToken.destroy({where: { user_id: user.id }, transaction: t });
            
            await RefreshToken.create({
                user_id: user.id,
                token: refreshToken,
                expires_at: expiryDateFromNow()
            },{ transaction: t });
    
            await t.commit();
            
            return sendResponse(res, HttpsStatus.OK, true, 'Login successful', {accessToken,refreshToken, user: { id: user.id, full_name: user.full_name, email: user.email }});
        }catch(err){
            await t.rollback();
            return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
        }

    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
    }
}

exports.logout = async (req, res) => {
    try{
        // const user_id = req.user?.id;
        // const { refreshToken } = req.body
        const { refreshToken } = req.headers['x-refresh-token'];
        
        // if(!user_id){
        //     return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Unauthorized', null, {auth: 'Missing'});
        // }

        if(!refreshToken){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Refresh token is required');
        }

        const deleted = await RefreshToken.destroy({ where: { token: refreshToken } });

        // if(!deleted){
        //     return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Invalid refresh token');
        // }

        return sendResponse(res, HttpsStatus.OK, true, 'Logged out successfully');
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, {server: err.message});
    }
}

exports.forgetPassword = async (req, res) => {
    try {
        const { email, password, confirmPassword } = req.body;
        
        const errors = {};
        
        if(!email){
            errors.email = 'Email is required';
        }
        
        if(!password){
            errors.password = 'Password is required';
        }

        if(!confirmPassword){
            errors.confirmPassword = 'Confirm Password is required';
        }
    
        if(Object.keys(errors).length > 0){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Missing fields!', null, errors);
        }

        const user = await User.findUserByEmail(email);
        
        if(!user){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Invalid email!');
        }

        if(password !== confirmPassword){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Password mismatch!');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.update({ password: hashedPassword }, { where: { id: user.id } });

        return sendResponse(res, HttpsStatus.OK, true, 'Password change!', null, { password: 'Password changed successfully' });
    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Something went wrong!', null, { server: err.message });
    }
}