const admin = require('../config/firebase');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
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
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    if (!decodedToken.uid) {
      console.warn('🔥 Invalid token payload - missing UID');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid token payload'
      });
    }

    const { uid, name, email, phone_number, picture } = decodedToken;
    
    const sanitizedUid = uid.toString().trim();
    
    if (!sanitizedUid || sanitizedUid.length < 10) {
      console.warn('🚫 Invalid UID format:', sanitizedUid);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid user identifier'
      });
    }

    console.log(`✅ Authenticated user with UID: ${sanitizedUid}`);
    
    req.userId = sanitizedUid;

    let user = await User.findOne({ googleId: sanitizedUid }).lean();
    
    if (!user) {
      console.log(`🆕 Creating new user record for UID: ${sanitizedUid}`);
      
      // Prepare update data based on available information
      const updateData = {
        googleId: sanitizedUid,
        name: name || 'Unknown',
        phone: phone_number || '',
        photoUrl: picture || null,
        role: 'unassigned',
        isActive: true,
        lastLogin: new Date()
      };
      
      // Only set email if it exists (for Google auth)
      if (email) {
        updateData.email = email;
        updateData.authProvider = 'google';
      } else if (phone_number) {
        updateData.authProvider = 'phone';
      }
      
      user = await User.findOneAndUpdate(
        { googleId: sanitizedUid },
        { $set: updateData },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true
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

    if (req.userId !== user.googleId) {
      console.error(`🚨 UID MISMATCH: req.userId=${req.userId}, user.googleId=${user.googleId}`);
      return res.status(500).json({
        error: 'Internal error',
        message: 'User identifier mismatch'
      });
    }

    req.user = user;

    // Role-based access control check
    if (req.requiredRole && user.role !== req.requiredRole) {
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

    console.log(`🔍 Auth success: userId=${req.userId}, role=${user.role}, method=${req.method}, authProvider=${user.authProvider || 'unknown'}`);
    
    next();

  } catch (error) {
    console.error('🔒 Authentication error:', error.message);
    
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

    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Could not authenticate user'
    });
  }
};

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