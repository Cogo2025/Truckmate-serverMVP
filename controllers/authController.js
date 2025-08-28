const admin = require('../config/firebase');
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');

// FIXED: Google Login/Registration with proper duplicate prevention
const googleLogin = async (req, res) => {
  try {
    const { idToken, name, phone, role } = req.body;

    console.log('🔐 Google login attempt:', { name, phone, role });

    if (!idToken || !name || !phone || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'idToken, name, phone, and role are required'
      });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, picture } = decodedToken;

    console.log('✅ Firebase token verified for UID:', uid);

    // *** CRITICAL: Use findOneAndUpdate with upsert to prevent duplicates ***
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
        upsert: true,        // Create if doesn't exist
        new: true,           // Return updated document
        runValidators: true  // Run schema validations
      }
    );

    console.log('👤 User created/updated:', user.googleId, 'Role:', user.role);

    // *** CRITICAL: Do NOT create driver profile here - only create it during profile setup ***
    // This was causing the empty profiles in your database

    // Generate JWT token (if you're using JWT)
    // const token = jwt.sign({ userId: user.googleId, role: user.role }, process.env.JWT_SECRET);

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
      // token: token  // Include if using JWT
    });

  } catch (error) {
    console.error('❌ Google login error:', error);
    
    if (error.code && error.code.startsWith('auth/')) {
      return res.status(401).json({
        error: 'Invalid Firebase token',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
  }
};

module.exports = {
  googleLogin
};
