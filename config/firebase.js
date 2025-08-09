const admin = require('firebase-admin');

function initializeFirebase() {
  try {
    // Safer environment variable access
    const base64Credentials = process.env.FIREBASE_KEY_BASE64?.replace(/\s/g, '') || '';
    
    if (!base64Credentials) {
      throw new Error('Firebase credentials not found. Please set FIREBASE_KEY_BASE64 environment variable.');
    }

    // Debug log (remove after verification)
    console.log('Base64 credentials length:', base64Credentials.length);

    const serviceAccount = JSON.parse(
      Buffer.from(base64Credentials, 'base64').toString('utf-8')
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });

    console.log('Firebase initialized successfully');
    return admin;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    if (error.message.includes('Unexpected token')) {
      console.error('Possible invalid base64 encoding');
    }
    process.exit(1);
  }
}

module.exports = initializeFirebase();