const admin = require('firebase-admin');
const serviceAccount = require('../../bossplan-messenger-1e4dd-firebase-adminsdk-fbsvc-1d17338796.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function sendPush({ token, title, body, data }) {
  if (!token) return;

  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: data ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ) : {}
    });
  } catch (err) {
    console.error('FCM error:', err.message);
  }
}

module.exports = { sendPush };
