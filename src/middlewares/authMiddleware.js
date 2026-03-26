const jwt = require('jsonwebtoken');
const { RefreshToken, User } = require('../models');
const { sendResponse, HttpsStatus } = require('../utils/response');
 
module.exports = async (req, res, next) => {
  try{
    const authHeader = req.headers.authorization;
    const device_id = req.headers['device_id'];
    const org_id = req.headers['organization_id'];

    const errors = {};

    if(!authHeader){
      errors.authHeader = 'Authorization header missing';
    }

    if(!device_id){
      errors.device_id = 'Device id missing';
    }

    if(!org_id){
      errors.org_id = 'Organization id missing!';
    }
    // if (!authHeader) {
    //   return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Authorization header missing!');
    // }

    // if (!device_id) {
    //   return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Device id missing!');
    // }

    if(Object.keys(errors).length > 0){
      return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Authorization header missing!', null, errors);
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') { 
      return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Invalid authorization format!');
    }

    const token = parts[1];
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    // check session
    const session = await RefreshToken.findOne({
      where: {
        user_id: payload.id,
        device_id: device_id
      }
    });

    if (!session) {
      return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Session expired, please login again!');
    }

    const user = await User.findByPk(payload.id);
    if(!user){
      return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'User not found!');
    }

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
      user.org_10
    ].filter(Boolean);

    if (!orgIds.includes(org_id)) {
      return sendResponse(
        res,
        HttpsStatus.FORBIDDEN,
        false,
        'User does not belong to this organization!'
      );
    }
    req.user = payload;
    req.device_id = device_id;
    req.org_id = org_id;
    next();
    // jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
    //   if (err) {
    //     return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Invalid or expired token', null, { auth: 'Invalid or expired token' });
    //   }

    //   // attach minimal user info from token
    //   req.user = payload; // e.g. { id, email, iat, exp }
    //   return next();
    // });
  }catch(err){
    console.error('Auth middleware error:', err);
      return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error', null, { server: err.message });
    }
}