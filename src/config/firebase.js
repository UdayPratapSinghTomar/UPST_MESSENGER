require('dotenv').config();
const admin = require('firebase-admin');
 
if (!process.env.FIREBASE) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT missing in env');
}
 
const serviceAccount = JSON.parse(process.env.FIREBASE);
// Fix multiline private key
serviceAccount.private_key =
  serviceAccount.private_key.replace(/\\n/g, '\n');
 
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase initialized');
}
 
module.exports = admin;