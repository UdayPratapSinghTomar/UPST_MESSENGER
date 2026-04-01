const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendResponse, HttpsStatus } = require('../../utils/response');
const { generateAccessToken, generateRefreshToken, expiryDateFromNow} = require('../../utils/tokens');

const { User, RefreshToken, Organization, sequelize, SharedFile, UserDevice } = require('../../models');
const { verifyRefreshToken } = require('../../utils/tokens');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sendEmail = require('../../utils/sendEmail');
const EVENTS = require('../../utils/socketEvents');

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
//         return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error', null, { server: err.message });
//         }
// };

// exports.adminRegister = async (req,res) => {
//     try{
//         const {
//             organization_name,
//             employee_size,
//             website,
//             full_name,
//             role = 'admin',
//             designation,
//             phone,
//             email,
//             password
//         } = req.body;
 
//         const file = req.file;
//         const errors = {};

//         if(!organization_name){
//             errors.organization_name = 'Organization name is required';
//         }
//         if(!employee_size){
//             errors.employee_size = 'Employee size is required';
//         }
//         if(!full_name){
//             errors.full_name = 'Full name is required';
//         }
//         if(!designation){
//             errors.designation = 'Job role is required';
//         }
//         if(!email){
//             errors.email = 'Email is required';
//         }
//         if(!password){
//             errors.password = 'Password is required';
//         }

//         if(Object.keys(errors).length > 0){
//            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Missing fields', null, errors);
//         }

//         const existingEmail = await User.findOne({ where: { email } });  
//         if(existingEmail){
//             return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Email already exists!');
//         }
//         const hashedPassword = await bcrypt.hash(password, 10);

//         const t = await sequelize.transaction();
//         try{
//             const organization = await Organization.create({'name': organization_name, employee_size, website }, { transaction: t })

//             const user = await User.create({
//                 full_name,
//                 email,
//                 phone,
//                 role,
//                 'password': hashedPassword,
//                 'organization_id': organization.id,
//                 designation
//             }, 
//             { transaction: t});

//             const defaultFileUrl = '/uploads/default/profile_pic.jpg';
//             const defaultFilePath = path.join(__dirname,'../../uploads/default/profile_pic.jpg');

//             if (fs.existsSync(defaultFilePath)) {
//                 const stats = fs.statSync(defaultFilePath);
        
//                 await SharedFile.create(
//                 {
//                     user_id: user.id,
//                     file_name: 'profile_pic.jpg',
//                     file_url: defaultFileUrl,
//                     file_type: 'image',
//                     file_size: stats.size,
//                     mime_type: 'image/jpeg',
//                 },
//                 {
//                     transaction: t,
//                 }
//                 );
//             }
//             await t.commit();
//             return sendResponse(res, HttpsStatus.CREATED, true, 'User created successfully!',user); 
//         }catch(err){
//             await t.rollback();
//             return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
//         }                     
//     }catch(err){
//         return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
//     } 
// };

// exports.userRegister = async (req,res) => {
//     try{
//         const {
//             full_name,
//             email,
//             password,
//             phone,
//             role = 'member',
//             designation,
//         } = req.body;

//         const errors = {};

//         if(!full_name){
//             errors.full_name = 'Full name is required';
//         }
//         if(!designation){
//             errors.designation = 'Designation is required';
//         }
//         if(!email){
//             errors.email = 'Email is required';
//         }
//         if(!password){
//             errors.password = 'Password is required';
//         }

//         if(Object.keys(errors).length > 0){
//            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Missing fields', null, errors);
//         }
//         // console.log('file path' ,path.join(__dirname,'../../uploads/default/profile_pic.jpg'))
//         // console.log('if condition',fs.existsSync(defaultFilePath))
//         const existingEmail = await User.findOne({ where: { email } });  
//         if(existingEmail){
//             return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Email already exists!');
//         }
//         const hashedPassword = await bcrypt.hash(password, 10);

//         const t = await sequelize.transaction();
//         try{
//             // const organization = await Organization.create({'name': organization_name, employee_size, website }, { transaction: t })

//             const user = await User.create({
//                 full_name,
//                 email,
//                 phone,
//                 role,
//                 'password': hashedPassword,
//                 designation
//             }, 
//             { transaction: t});
            
//             const defaultFileUrl = '/uploads/default/profile_pic.jpg';
//             const defaultFilePath = path.join(__dirname,'../../uploads/default/profile_pic.jpg');

//             if (fs.existsSync(defaultFilePath)) {
//                 const stats = fs.statSync(defaultFilePath);
        
//                 await SharedFile.create(
//                 {
//                     user_id: user.id,
//                     file_name: 'profile_pic.jpg',
//                     file_url: defaultFileUrl,
//                     file_type: 'image',
//                     file_size: stats.size,
//                     mime_type: 'image/jpeg',
//                 },
//                 {
//                     transaction: t,
//                 }
//                 );
//             }
//             await t.commit();
//             return sendResponse(res, HttpsStatus.CREATED, true, 'User created successfully!',user); 
//         }catch(err){
//             console.log(err);
//             await t.rollback();
//             return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
//         }                     
//     }catch(err){
//         return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
//     } 
// };


exports.adminRegister = async (req,res) => {
    try{
        const {
            organization_name,
            employee_size,
            website,
            full_name,
            role,
            designation,
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
        if(!designation){
            errors.designation = 'Job role is required';
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
                                        role : role ? role : 'admin',
                                        'password': hashedPassword,
                                        'organization_id': organization.id,
                                        designation
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

exports.userRegister = async (req,res) => {
    try{
        const {
            full_name,
            email,
            password,
            phone,
            role,
            designation,
            organization_id
        } = req.body;

        const errors = {};

        if(!full_name){
            errors.full_name = 'Full name is required';
        }
        if(!designation){
            errors.designation = 'Job profile is required';
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
            // const organization = await Organization.create({'name': organization_name, employee_size, website }, { transaction: t })

            const user = await User.create({
                                        full_name,
                                        email,
                                        phone,
                                        role : role ? role : 'member',
                                        'password': hashedPassword,
                                        'organization_id': organization_id,
                                        designation
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
        const { email, password, device_id, device_type, fcm_token, force_login = false } = req.body
        const errors = {};
        
        if(!email){
           errors.email = 'Email is required';
        }
        if(!password){
            errors.password = 'Password is required';
        }
        if(!device_id){
            errors.device_id = 'Device id is required';
        }
        if(!device_type){
            errors.device_type = 'Device type is required';
        }
        if(!fcm_token){
            errors.fcm_token = 'FCM token is required';
        }

        if(Object.keys(errors).length > 0){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Validation failed!', null, errors);
        }

        const user = await User.findOne({
            where: { 
                email, 
                is_deleted: false 
            },
            include: [{
                model: SharedFile,
                as: 'uploadedFiles',
                attributes: ['file_url', 'chat_id', 'message_id'],
                required: false,
                where: { chat_id: null, message_id: null, user_id: { [Op.ne]: null } }
            }]
        });

        // console.log(user);
        if(!user){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Invalid credentials!', null, {email: 'Invalid credentials!'});
        }
            
        let matchPassword = await bcrypt.compare(password, user.password);
        if(!user || !matchPassword){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Invalid credentials!');
        }

        const existingSession = await UserDevice.findOne({
            where: {
                user_id: user.id,
                is_active: true
            }
        });

        if(existingSession && existingSession.device_id !== device_id && !force_login){
            return sendResponse(res, HttpsStatus.FORBIDDEN, false, 'User already logged in another device', { already_logged_in: true });
        }

        const io = req.app.get('io');
        
        if(force_login && existingSession){

            /**
             * Destroy refresh tokens of previous devices
             */

            await RefreshToken.destroy({
                where: {
                    user_id: user.id,
                    device_id: {
                        [Op.ne]: device_id
                    }
                }
            });

            /**
             * Deactivate previous devices
             */

            await UserDevice.update(
                { is_active: false },
                {
                where: {
                    user_id: user.id,
                    device_id: { [Op.ne]: device_id }
                }
                }
            );

            /**
             * Get previously active devices except current device
             */

            // const previousDevices = await UserDevice.findAll({
            //     where: {
            //     user_id: user.id,
            //     is_active: true,
            //     device_id: { [Op.ne]: device_id }
            //     }
            // });

            /**
             * 4️⃣ Notify previous devices
             */

            // for (const device of previousDevices) {

            //     await notifyUser(io, {
            //     recipient_id: user.id,
            //     type: 'security',
            //     event: EVENTS.FORCE_LOGOUT,
            //     title: 'Logged out from another device',
            //     body: 'Your account was logged in from another device.'
            //     });
            // }
        }

        const payload = {id: user.id, email: user.email};

        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);
    
        // const t = await sequelize.transaction();
        // try{
            // await RefreshToken.destroy({where: { user_id: user.id }, transaction: t });
            
        await RefreshToken.create({
            user_id: user.id,
            token: refreshToken,
            device_id,
            expires_at: expiryDateFromNow()
        });
    
        await UserDevice.upsert({
            user_id: user.id,
            device_id,
            device_type,
            fcm_token,
            is_active: true,
            last_seen_at: new Date()
        });
        
        const orgIds = [
            user.organization_id,
            user.org_2,
            user.org_3,
            user.org_4,
            user.org_5,
            user.org_6,
            user.org_7,
            user.org_8,
            user.org_9,
            user.org_10,
        ].filter(Boolean);

        const uniqueOrgIds = [...new Set(orgIds)];

        const organizations = await Organization.findAll({
            where: { id: uniqueOrgIds },
            attributes: ["id", "name"],
        });
        // await t.commit();
            
        const BASE_URL = process.env.BASE_URL;

        const formattedUser = {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            designation: user.designation,

            // ✅ profile image with full URL
            profile_url: user.uploadedFiles?.[0]?.file_url ? BASE_URL+user.uploadedFiles?.[0]?.file_url : null,
            bio: user.bio,
            status: user.status,
            organizations
        };

        // return sendResponse(res, HttpsStatus.OK, true, 'Login successful', {accessToken,refreshToken, user: {...user.toJSON(), profile_image,organizations } });
        return sendResponse(res, HttpsStatus.OK, true, 'Login successful', {accessToken,refreshToken, user: formattedUser });
        // }catch(err){
        //     await t.rollback();
        //     return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
        // }

    }catch(err){
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
    }
};

exports.logout = async (req, res) => {
    try {
        // const { device_id } = req.body;
        const device_id = req.device_id;
        const user_id = req.user.id;

        if (!device_id) {
            return sendResponse(
                res,
                HttpsStatus.BAD_REQUEST,
                false,
                'Device id is required'
            );
        } 

        const session = await RefreshToken.findOne({
            where: { device_id, user_id }
        });

        if(!session){
            return sendResponse(
            res,
            HttpsStatus.BAD_REQUEST,
            false,
            'User session not found!'
        );
        }

        await RefreshToken.destroy({
            where: {
                device_id: device_id,
                user_id
            }
        });

        await UserDevice.update(
            { is_active: false },
            { where: { device_id, user_id } }
        );

        return sendResponse(
            res,
            HttpsStatus.OK,
            true,
            'Logged out successfully'
        );
    } catch (err) {
        return sendResponse(
            res,
            HttpsStatus.INTERNAL_SERVER_ERROR,
            false,
            'Server error!',
            null,
            { server: err.message }
        );
    }
};

// exports.logoutFromAllDevice = async (req, res) => {
//     try {
//         const userId = req.user.id;

//         await RefreshToken.destroy({
//             where: {
//                 user_id: userId
//             }
//         });

//         return sendResponse(res, HttpsStatus.OK, true, 'Logged out from all devices successfull!');
//     } catch (err) {
//         return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message } );
//     }
// }

exports.requestPasswordOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if(!email){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Mail is required!');
        }

        const user = await User.findOne({ where: { email, is_deleted: false } });
        if(!user){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, 'Mail not found!');
        }
        console.log('email----',email);
        console.log('user ---',user);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('OTP ---',otp);
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        await user.update({
            reset_password_otp: hashedOtp,
            reset_password_expiry: expiry
        });

        await sendEmail({
            to: user.email,
            subject: "Your Password Reset OTP",
            text: `Your OTP for password reset is ${otp}. It expires in 10 minutes.`,
            html: `<p>Your OTP for password reset is <b>${otp}</b>. It expires in 10 minutes.</p>`
        });

        console.log(await sendEmail({
            to: user.email,
            subject: "Your Password Reset OTP",
            text: `Your OTP for password reset is ${otp}. It expires in 10 minutes.`,
            html: `<p>Your OTP for password reset is <b>${otp}</b>. It expires in 10 minutes.</p>`
        }));
        
        return sendResponse(res, HttpsStatus.OK, true, 'Please check your mail for the OTP!');
    } catch (err) {
        console.log('errr --- ',err);
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error!', null, { server: err.message });
    }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const errors = {};
 
    if (!email) errors.email = "Email is required!";
    if (!otp) errors.otp = "OTP is required!";

    if (Object.keys(errors).length > 0) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Missing fields!", null, errors);
    }

    // Find the user by email
    const user = await User.findOne({ where: { email, is_deleted: false } });
    if (!user || !user.reset_password_otp || !user.reset_password_expiry) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Invalid OTP!");
    }

    // Check if OTP expired
    const currentTime = new Date();
    if (currentTime > new Date(user.reset_password_expiry)) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "OTP expired!");
    }

    // Hash received OTP
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (hashedOtp !== user.reset_password_otp) {
      return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Invalid OTP!");
    }

    // Clear OTP so it can’t be reused
    await user.update({
      reset_password_otp: null,
      reset_password_expiry: null
    });

    return sendResponse(res, HttpsStatus.OK, true, "OTP verified successfully!");
  } catch (err) {
    console.error("verifyOtp error:", err);
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      { server: err.message }
    );
  }
};

exports.updatePassword = async (req, res) => {
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

        // const user = await User.findUserByEmail(email);
        const user = await User.findOne({ where: { email, is_deleted: false } });
        
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
};  