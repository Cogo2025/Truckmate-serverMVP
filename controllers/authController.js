const admin = require('../config/firebase');
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');

// FIXED: Google Login/Registration with proper field validation
const googleLogin = async (req, res) => {
  try {
    console.log('🔐 Google login request received');
    console.log('📥 Request body:', req.body);

    const { idToken, name, phone, role } = req.body;

    // *** ENHANCED VALIDATION: Different requirements for login vs registration ***
    if (!idToken || !name) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'idToken and name are required'
      });
    }

    console.log('🔑 Verifying Firebase token...');

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, picture } = decodedToken;

    console.log('✅ Firebase token verified for UID:', uid);

    // Check if this is registration (has phone and role) or login (just idToken and name)
    if (phone && role) {
      // *** REGISTRATION REQUEST ***
      console.log('📝 Processing registration request');

      if (!phone.trim() || !role.trim()) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Phone and role are required for registration'
        });
      }

      const user = await User.findOneAndUpdate(
        { googleId: uid },
        {
          $set: {
            googleId: uid,
            name: name.trim(),
            email: email || '',
            phone: phone.trim(),
            photoUrl: picture || '',
            role: role,
            isActive: true,
            registrationCompleted: true,
            lastLogin: new Date()
          }
        },
        {
          upsert: true,
          new: true,
          runValidators: true
        }
      );

      console.log('👤 User registered:', user.googleId, 'Role:', user.role);

      res.status(200).json({
        success: true,
        user: {
          id: user.googleId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          photoUrl: user.photoUrl,
          role: user.role,
          isActive: user.isActive,
          registrationCompleted: user.registrationCompleted
        },
        message: 'Registration successful'
      });

    } else {
      // *** LOGIN REQUEST ***
      console.log('🔐 Processing login request');

      const user = await User.findOne({ googleId: uid });

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Please complete registration first',
          needsRegistration: true
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      console.log('👤 User logged in:', user.googleId, 'Role:', user.role);

      res.status(200).json({
        success: true,
        user: {
          id: user.googleId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          photoUrl: user.photoUrl,
          role: user.role,
          isActive: user.isActive,
          registrationCompleted: user.registrationCompleted
        },
        message: 'Login successful'
      });
    }

  } catch (error) {
    console.error('❌ Google login error:', error);
    
    if (error.code && error.code.startsWith('auth/')) {
      return res.status(401).json({
        error: 'Invalid Firebase token',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Authentication failed',
      details: error.message
    });
  }
};

module.exports = {
  googleLogin
};
