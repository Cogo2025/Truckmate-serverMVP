const admin = require('firebase-admin');

// Robust initialization with error handling
function initializeFirebase() {
  try {
    // Get and clean the base64 string (remove any whitespace/newlines)
    const base64Credentials = process.env.FIREBASE_KEY_BASE64.replace(/\s/g, '');
    
    if (!base64Credentials) {
      throw new Error('Firebase credentials not found in environment variables');
    }

    // Decode and parse
    const serviceAccount = JSON.parse(
      Buffer.from(base64Credentials, 'base64').toString('utf-8')
    );

    // Initialize Firebase
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });

    console.log('Firebase initialized successfully');
    return admin;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    process.exit(1);
  }
}

module.exports = initializeFirebase();