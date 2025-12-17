const jwt = require('jsonwebtoken');
const { sendResponse, HttpsStatus } = require('../utils/response');
 
module.exports = async (req, res, next) => {
  try{
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Login required', null, { auth: 'Authorization header missing' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') { 
      return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Login required', null, { auth: 'Invalid authorization format' });
    }

    const token = parts[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
      if (err) {
        return sendResponse(res, HttpsStatus.UNAUTHORIZED, false, 'Invalid or expired token', null, { auth: 'Invalid or expired token' });
      }

      // attach minimal user info from token
      req.user = payload; // e.g. { id, email, iat, exp }
      return next();
    });
  }catch(err){
    console.error('Auth middleware error:', err);
      return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, 'Server error', null, { server: err.message });
    }
}
