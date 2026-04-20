const { createClient } = require('@supabase/supabase-js');
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
      return sendResponse(
        res,
        HttpsStatus.UNAUTHORIZED,
        false,
        'Validation failed!',
        null,
        errors
      );
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return sendResponse(
        res,
        HttpsStatus.UNAUTHORIZED,
        false,
        'Invalid authorization format!'
      );
    }

    const token = parts[1];

    // =====================================================
    // 🔐 Create Supabase client WITH USER TOKEN (IMPORTANT)
    // =====================================================
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // =====================================================
    // ✅ VERIFY USER VIA SUPABASE
    // =====================================================
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return sendResponse(
        res,
        HttpsStatus.UNAUTHORIZED,
        false,
        'Invalid or expired token'
      );
    }

    const user = data.user;

    // =====================================================
    // 📱 CHECK DEVICE SESSION (user_devices table)
    // =====================================================
    const { data: device, error: deviceError } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('device_id', device_id)
      .eq('is_active', true)
      .maybeSingle();

    if (deviceError || !device) {
      return sendResponse(
        res,
        HttpsStatus.UNAUTHORIZED,
        false,
        'Session expired, please login again!'
      );
    }

    // =====================================================
    // ✅ ATTACH DATA TO REQUEST
    // =====================================================
    req.user = user;        // full supabase user
    req.user_id = user.id;  // shortcut
    req.device_id = device_id;
    req.supabase = supabase; // 🔥 IMPORTANT (reuse in APIs)

    next();

  } catch (err) {
    console.error('Auth middleware error:', err);

    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      'Server error',
      null,
      { server: err.message }
    );
  }
};