const admin = require('../config/firebase');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const OwnerProfile = require('../models/OwnerProfile');

exports.googleLogin = async (req, res) => {
  const { idToken, role, name, phone } = req.body;

  try {
    // 1. Verify the Google ID token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, picture } = decodedToken;

    // 2. Check if user exists in our database
    let user = await User.findOne({ googleId: uid });

    if (!user) {
      // 3. Handle new user registration
      if (!role || role.trim() === "") {
        // Case: New user but hasn't selected role yet
        return res.status(200).json({
          token: null,
          user: {
            new: true,
            googleId: uid,
            name: name || decodedToken.name,
            email,
            photoUrl: picture,
            role: ""
          }
        });
      }

      // 4. Create new user with selected role
      user = await User.create({
        googleId: uid,
        role,
        name: name || decodedToken.name,
        phone: phone || '',
        email,
        photoUrl: picture
      });

      // 5. Create empty profile based on role
      if (role === 'driver') {
        await DriverProfile.create({ 
          userId: user._id,
          // Set default values
          knownTruckTypes: [],
          experience: '',
          licensePhoto: ''
        });
      } else if (role === 'owner') {
       await OwnerProfile.create({
  userId: user._id,
  companyName: 'unknown',
  companyLocation: 'unknown',
  gender: 'Not Specified', // ✅ Matches enum
  photoUrl: '',
  companyInfoCompleted: false
});


      }
    }

    // 6. Generate JWT token for authentication
    const token = jwt.sign({ 
      userId: user._id,
      role: user.role // Include role in the token
    }, process.env.JWT_SECRET, { expiresIn: '3d' });

    // 7. Return success response
    res.status(200).json({ 
      token, 
      user: {
        _id: user._id,
        googleId: user.googleId,
        role: user.role,
        name: user.name,
        phone: user.phone,
        email: user.email,
        photoUrl: user.photoUrl,
        // Include profile completion status
        profileCompleted: user.role === 'driver' ? 
          await DriverProfile.exists({ userId: user._id }) :
          await OwnerProfile.findOne({ userId: user._id }).select('companyInfoCompleted')
      }
    });

  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
};