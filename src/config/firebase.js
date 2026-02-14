require('dotenv').config();
const admin = require('firebase-admin');
// const serviceAccount = process.env.FIREBASE;
const serviceAccount = require('../../bossplan-messenger-1e4dd-firebase-adminsdk-fbsvc-1d17338796.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function sendPush({ token, title, body, data = {} }) {
  if (!token){
    return;
  } 

  try {
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      )
    };

    await admin.messaging().send(message);
    return 'Push notification sent';
  } catch (err) {
    console.error('FCM error:', err);
    throw err;
  }
}

module.exports = { sendPush };