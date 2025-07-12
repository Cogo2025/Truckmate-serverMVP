// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { googleLogin } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware'); // Destructured import
const User = require('../models/User');

// 🔐 Login with Google
router.post('/google-login', googleLogin);

// ✅ Get current authenticated user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Find user by googleId from the authenticated request
    const user = await User.findOne({ googleId: req.userId });
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'No user exists with this Google ID' 
      });
    }

    // Return user data (excluding sensitive fields)
    const userData = {
      _id: user._id,
      googleId: user.googleId,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
      photoUrl: user.photoUrl,
      isAvailable: user.isAvailable,
      createdAt: user.createdAt
    };

    res.status(200).json(userData);

  } catch (err) {
    console.error("Failed to fetch user info:", err);
    res.status(500).json({ 
      error: 'Server error',
      details: err.message 
    });
  }
});

module.exports = router;