const admin = require('firebase-admin');
const serviceAccount = require('../../bossplan-messenger-1e4dd-firebase-adminsdk-fbsvc-1d17338796.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;