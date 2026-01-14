const admin = require('../config/firebase');
const User = require('../models/User');

// Phone Login/Registration
const phoneLogin = async (req, res) => {
  try {
    console.log('📱 Phone login request received');
    console.log('📥 Request body:', req.body);

    const { idToken, name, phone, role } = req.body;

    // Validate required fields
    if (!idToken) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'idToken is required'
      });
    }

    console.log('🔐 Verifying Firebase token...');

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, phone_number } = decodedToken;

    console.log('✅ Firebase token verified for UID:', uid);
    console.log('📞 Phone number from token:', phone_number);

    // Check if this is registration (has name and role) or login
    if (name && role && phone) {
      // *** REGISTRATION REQUEST ***
      console.log('🆕 Processing registration request');

      if (!name.trim() || !role.trim() || !phone.trim()) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Name, phone and role are required for registration'
        });
      }

      // Verify phone matches token
      const normalizedPhone = phone.replace(/\s+/g, '');
      const tokenPhone = phone_number?.replace(/\s+/g, '');
      
      if (tokenPhone && normalizedPhone !== tokenPhone) {
        return res.status(400).json({
          error: 'Phone mismatch',
          details: 'Phone number does not match authenticated number'
        });
      }

      const updateData = {
        googleId: uid,
        name: name.trim(),
        phone: normalizedPhone,
        photoUrl: '',
        role: role,
        isActive: true,
        registrationCompleted: true,
        lastLogin: new Date(),
        authProvider: 'phone'
      };
      
      // Only set email if it exists
      if (phone_number || tokenPhone) {
        // Email is optional for phone auth, don't set it
      }

      const user = await User.findOneAndUpdate(
        { googleId: uid },
        { $set: updateData },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true
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
      console.log('🔑 Processing login request');

      const user = await User.findOne({ googleId: uid });

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Please complete registration first',
          needsRegistration: true,
          phone: phone_number // Send phone back for pre-filling
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
    console.error('❌ Phone login error:', error);
    
    // Fixed: Handle MongoDB errors properly
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.email === 1) {
        return res.status(409).json({
          error: 'Email conflict',
          details: 'A user with this email already exists',
          code: 'DUPLICATE_EMAIL'
        });
      }
      return res.status(409).json({
        error: 'Duplicate key error',
        details: error.message,
        code: 'DUPLICATE_KEY'
      });
    }
    
    // Handle Firebase auth errors
    if (error.code && typeof error.code === 'string' && error.code.startsWith('auth/')) {
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

// Keep the Google login for backward compatibility (optional)
const googleLogin = async (req, res) => {
  try {
    console.log('🔍 Google login request received');
    console.log('📥 Request body:', req.body);

    const { idToken, name, phone, role } = req.body;

    if (!idToken || !name) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'idToken and name are required'
      });
    }

    console.log('🔐 Verifying Firebase token...');

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, picture } = decodedToken;

    console.log('✅ Firebase token verified for UID:', uid);

    if (phone && role) {
      // Registration
      console.log('🆕 Processing registration request');

      if (!phone.trim() || !role.trim()) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Phone and role are required for registration'
        });
      }

      const updateData = {
        googleId: uid,
        name: name.trim(),
        phone: phone.trim(),
        photoUrl: picture || '',
        role: role,
        isActive: true,
        registrationCompleted: true,
        lastLogin: new Date(),
        authProvider: 'google'
      };
      
      // Set email if available from Google
      if (email) {
        updateData.email = email;
      }

      const user = await User.findOneAndUpdate(
        { googleId: uid },
        { $set: updateData },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true
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
      // Login
      console.log('🔑 Processing login request');

      const user = await User.findOne({ googleId: uid });

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Please complete registration first',
          needsRegistration: true
        });
      }

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
    
    // Fixed: Handle MongoDB errors properly
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.email === 1) {
        return res.status(409).json({
          error: 'Email conflict',
          details: 'A user with this email already exists',
          code: 'DUPLICATE_EMAIL'
        });
      }
      return res.status(409).json({
        error: 'Duplicate key error',
        details: error.message,
        code: 'DUPLICATE_KEY'
      });
    }
    
    if (error.code && typeof error.code === 'string' && error.code.startsWith('auth/')) {
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
  phoneLogin,
  googleLogin
};