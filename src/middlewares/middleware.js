const jwt = require('jsonwebtoken');
const { RefreshToken, User } = require('../models');
const { sendResponse, HttpsStatus } = require('../utils/response');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const device_id = req.headers['device_id'];

    const errors = {};

    if (!authHeader) {
      errors.authHeader = 'Authorization header missing';
    }

    if (!device_id) {
      errors.device_id = 'Device id missing';
    }

    if (Object.keys(errors).length > 0) {
      return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Missing headers', null, errors);
    }

//     const parts = authHeader.split(' ');
//     if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
//       return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Invalid authorization format!');
//     }

//     const token = parts[1];
//     const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

//     const session = await RefreshToken.findOne({
//       where: {
//         user_id: payload.id,
//         device_id
//       }
//     });

//     if (!session) {
//       return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Session expired!');
//     }

//     const user = await User.findByPk(payload.id);
//     if (!user) {
//       return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'User not found!');
//     }

//     req.user = payload;
//     req.device_id = device_id;

//     next();
//   } catch (err) {
//     console.error('Auth middleware error:', err);
//     return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error', null, { server: err.message });
//   }
// };