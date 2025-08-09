const admin = require('../config/firebase'); // Use the centralized config
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('❌ No token provided or malformed Authorization header');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No authentication token provided or malformed header'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    if (!decodedToken.uid) {
      console.warn('🔥 Invalid token payload - missing UID');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid token payload'
      });
    }

    const { uid, name, email, phone_number, picture } = decodedToken;
    console.log(`✅ Authenticated user with UID: ${uid}`);
    
    // Set UID in request for downstream use
    req.userId = uid;

    // Find or create user in database
    let user = await User.findOne({ googleId: uid }).lean();
    
    if (!user) {
      console.log(`🆕 Creating new user record for UID: ${uid}`);
      user = await User.create({
        googleId: uid,
        name: name || 'Unknown',
        email: email || null,
        phone: phone_number || '',
        photoUrl: picture || null,
        role: 'unassigned', // Default role until set
        isActive: true
      });
    }

    // Attach full user object to request
    req.user = user;

    // Role-based access control check
    if (req.requiredRole && user.role !== req.requiredRole) {
      console.warn(`🚫 Role mismatch - Required: ${req.requiredRole}, Actual: ${user.role}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();

  } catch (error) {
    console.error('🔐 Authentication error:', error.message);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.'
      });
    }

    if (error.code === 'auth/argument-error') {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Malformed authentication token'
      });
    }

    // Generic error response
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Could not authenticate user'
    });
  }
};

// Role-specific middleware wrapper
const requireRole = (role) => {
  return (req, res, next) => {
    req.requiredRole = role;
    authMiddleware(req, res, next);
  };
};

module.exports = {
  authMiddleware,
  requireRole,
  requireOwner: requireRole('owner'),
  requireDriver: requireRole('driver'),
  requireAdmin: requireRole('admin')
};
