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
    
    // *** CRITICAL FIX: Ensure consistent UID format ***
    const sanitizedUid = uid.toString().trim();
    
    if (!sanitizedUid || sanitizedUid.length < 10) {
      console.warn('🚫 Invalid UID format:', sanitizedUid);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid user identifier'
      });
    }

    console.log(`✅ Authenticated user with UID: ${sanitizedUid}`);
    
    // *** CRITICAL: Use sanitized UID consistently ***
    req.userId = sanitizedUid;

    // Find or create user in database using sanitized UID
    let user = await User.findOne({ googleId: sanitizedUid }).lean();
    
    if (!user) {
      console.log(`🆕 Creating new user record for UID: ${sanitizedUid}`);
      
      // *** CRITICAL: Use findOneAndUpdate with upsert to prevent race conditions ***
      user = await User.findOneAndUpdate(
        { googleId: sanitizedUid },
        {
          $set: {
            googleId: sanitizedUid,
            name: name || 'Unknown',
            email: email || null,
            phone: phone_number || '',
            photoUrl: picture || null,
            role: 'unassigned', // Default role until set
            isActive: true,
            lastLogin: new Date()
          }
        },
        {
          upsert: true,
          new: true,
          runValidators: true
        }
      ).lean();
      
      console.log(`✅ User record created/found: ${user.googleId}`);
    } else {
      // Update last login for existing users
      await User.findOneAndUpdate(
        { googleId: sanitizedUid },
        { $set: { lastLogin: new Date() } }
      );
    }

    // *** CRITICAL: Double-check userId consistency ***
    if (req.userId !== user.googleId) {
      console.error(`🚨 UID MISMATCH: req.userId=${req.userId}, user.googleId=${user.googleId}`);
      return res.status(500).json({
        error: 'Internal error',
        message: 'User identifier mismatch'
      });
    }

    // Attach full user object to request
    req.user = user;

    // Role-based access control check
    if (req.requiredRole && user.role !== req.requiredRole) {
      // Allow users with unassigned roles to create their first profile
      if (user.role === 'unassigned' && req.method === 'POST') {
        console.log(`ℹ️ Allowing unassigned user ${user.googleId} to create ${req.requiredRole} profile`);
      } else {
        console.warn(`🚫 Role mismatch - Required: ${req.requiredRole}, Actual: ${user.role}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }
    }

    // *** ADDITIONAL LOGGING FOR DEBUGGING ***
    console.log(`🔐 Auth success: userId=${req.userId}, role=${user.role}, method=${req.method}`);
    
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
