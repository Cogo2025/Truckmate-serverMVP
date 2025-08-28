const DriverProfile = require('../models/DriverProfile');
const User = require('../models/User');

const checkDriverApproval = async (req, res, next) => {
  try {
    console.log('🔍 Checking driver approval for:', req.userId);

    // Get user data first
    const user = await User.findOne({ googleId: req.userId });
    
    if (!user) {
      return res.status(403).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
        message: "Please complete registration first",
        redirectTo: "/register"
      });
    }

    // Skip check for non-driver users
    if (user.role !== 'driver') {
      console.log('✅ Non-driver user, skipping approval check');
      return next();
    }

    const driverProfile = await DriverProfile.findOne({ userId: req.userId });
    
    if (!driverProfile) {
      return res.status(403).json({
        error: "Profile not found",
        code: "NO_PROFILE",
        message: "Please complete your driver profile first",
        redirectTo: "/driver-profile-setup"
      });
    }

    if (!driverProfile.profileCompleted) {
      return res.status(403).json({
        error: "Profile incomplete",
        code: "INCOMPLETE_PROFILE",
        message: "Please complete your driver profile",
        redirectTo: "/driver-profile-setup"
      });
    }

    if (driverProfile.verificationStatus === 'pending') {
      return res.status(403).json({
        error: "Verification pending",
        code: "VERIFICATION_PENDING",
        message: "Your profile is under review. Please wait for admin approval.",
        verificationStatus: "pending"
      });
    }

    if (driverProfile.verificationStatus === 'rejected') {
      return res.status(403).json({
        error: "Verification rejected",
        code: "VERIFICATION_REJECTED",
        message: driverProfile.rejectionReason || "Your profile was rejected. Please update and resubmit.",
        verificationStatus: "rejected",
        rejectionReason: driverProfile.rejectionReason
      });
    }

    if (driverProfile.verificationStatus !== 'approved') {
      return res.status(403).json({
        error: "Verification required",
        code: "NOT_VERIFIED",
        message: "Your profile needs to be verified",
        verificationStatus: driverProfile.verificationStatus
      });
    }

    // All checks passed
    console.log('✅ Driver approved:', req.userId);
    req.driverProfile = driverProfile;
    next();

  } catch (err) {
    console.error('❌ Driver approval check error:', err);
    res.status(500).json({ 
      error: "Server error during verification check",
      details: err.message 
    });
  }
};

module.exports = { checkDriverApproval };
