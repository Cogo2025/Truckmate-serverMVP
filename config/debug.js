const base64Credentials = process.env.FIREBASE_KEY_BASE64;
console.log('Base64 length:', base64Credentials.length);
const decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');
console.log('Decoded content:', decoded);