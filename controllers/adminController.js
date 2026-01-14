const User = require('../models/User');
const Admin = require('../models/admin');
const DriverProfile = require('../models/DriverProfile');
const OwnerProfile = require('../models/OwnerProfile');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const VerificationRequest = require('../models/VerificationRequest');

// Generate JWT token
const generateToken = (adminId) => {
  return jwt.sign({ adminId, isAdmin: true }, process.env.JWT_SECRET, {
    expiresIn: '8h'
  });
};

// ✅ FIXED: Initial admin login or setup
const initialLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('🔐 Initial login attempt for:', username);

    // Check if any admin exists
    const existingAdmin = await Admin.findOne({ username });

    if (!existingAdmin) {
      // ✅ FIXED: Only allow creation with correct default credentials
      if (username !== '123user' || password !== '123user') {
        console.log('❌ Invalid initial credentials');
        return res.status(401).json({
          success: false,
          error: "Invalid initial credentials. Use default admin: 123user / 123user"
        });
      }

      console.log('📝 Creating first admin...');
      const firstAdmin = await Admin.create({
        username: '123user',
        password: '123user',  // Will be hashed by pre-save hook
        isFirstLogin: true,
        isActive: true
      });

      const token = generateToken(firstAdmin._id);

      console.log('✅ First admin created successfully');
      return res.status(200).json({
        success: true,
        message: "First admin created successfully.",
        token,
        admin: {
          id: firstAdmin._id,
          username: firstAdmin.username,
          isFirstLogin: true
        }
      });
    } else {
      // ✅ FIXED: Admin exists, validate password using comparePassword method
      console.log('🔍 Validating password for existing admin...');
      const isPasswordCorrect = await existingAdmin.comparePassword(password);
      
      if (!isPasswordCorrect) {
        console.log('❌ Invalid password');
        return res.status(401).json({
          success: false,
          error: "Invalid password"
        });
      }

      existingAdmin.lastLogin = new Date();
      await existingAdmin.save();

      const token = generateToken(existingAdmin._id);

      console.log('✅ Login successful');
      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        admin: {
          id: existingAdmin._id,
          username: existingAdmin.username,
          isFirstLogin: !!existingAdmin.isFirstLogin,
          lastLogin: existingAdmin.lastLogin
        }
      });
    }
  } catch (err) {
    console.error('❌ Initial login error:', err);
    res.status(500).json({
      success: false,
      error: "Server error",
      details: err.message
    });
  }
};

// Reuse initialLogin for adminLogin endpoint
const adminLogin = initialLogin;

// Change admin password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.adminId;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 6 characters long"
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ 
        success: false,
        error: "Admin not found" 
      });
    }

    // ✅ FIXED: Only check current password if not first login
    if (!admin.isFirstLogin) {
      const isCurrentPasswordCorrect = await admin.comparePassword(currentPassword);
      if (!isCurrentPasswordCorrect) {
        return res.status(401).json({ 
          success: false,
          error: "Current password is incorrect" 
        });
      }
    }

    admin.password = newPassword;
    admin.isFirstLogin = false;
    await admin.save();

    res.status(200).json({ 
      success: true, 
      message: "Password changed successfully" 
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ 
      success: false,
      error: "Server error", 
      details: err.message 
    });
  }
};

// Create new admin
const createNewAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const createdBy = req.adminId;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false,
        error: "Username and password are required" 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: "Password must be at least 6 characters long" 
      });
    }

    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false,
        error: "Username already exists" 
      });
    }

    const newAdmin = await Admin.create({
      username,
      password,
      createdBy,
      isFirstLogin: true,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "New admin created successfully",
      admin: {
        id: newAdmin._id,
        username: newAdmin.username,
        createdAt: newAdmin.createdAt
      }
    });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ 
      success: false,
      error: "Server error", 
      details: err.message 
    });
  }
};

// Dashboard data API
const getDashboardData = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const verificationStats = await VerificationRequest.aggregate([
      {
        $group: {
          _id: null,
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } }
        }
      }
    ]);

    const [totalUsers, totalDrivers, totalOwners, activeDrivers, recentUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'driver' }),
      User.countDocuments({ role: 'owner' }),
      User.countDocuments({ role: 'driver', isAvailable: true }),
      User.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $lookup: {
            from: 'driverprofiles',
            localField: 'googleId',
            foreignField: 'userId',
            as: 'driverProfile'
          }
        },
        {
          $lookup: {
            from: 'ownerprofiles',
            localField: 'googleId',
            foreignField: 'userId',
            as: 'ownerProfile'
          }
        },
        {
          $addFields: {
            profile: {
              $cond: {
                if: { $eq: ['$role', 'driver'] },
                then: { $arrayElemAt: ['$driverProfile', 0] },
                else: { $arrayElemAt: ['$ownerProfile', 0] }
              },
            },
            photoUrl: {
              $cond: {
                if: { $eq: ['$role', 'driver'] },
                then: { $arrayElemAt: ['$driverProfile.profilePhoto', 0] },
                else: { $arrayElemAt: ['$ownerProfile.photoUrl', 0] }
              }
            }
          }
        },
        { $unset: ['driverProfile', 'ownerProfile'] },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            id: '$googleId',
            name: 1,
            email: 1,
            phone: 1,
            photoUrl: 1,
            role: 1,
            isAvailable: 1,
            createdAt: 1,
            profile: 1
          }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          totalUsers,
          totalDrivers,
          totalOwners,
          activeDrivers
        },
        recentUsers,
        verificationStats: verificationStats[0] || { pending: 0, approved: 0, rejected: 0 }
      }
    });
  } catch (err) {
    console.error('Dashboard data error:', err);
    res.status(500).json({ 
      success: false,
      error: "Server error", 
      details: err.message 
    });
  }
};

// Get all drivers
const getAllDrivers = async (req, res) => {
  try {
    const drivers = await User.aggregate([
      { $match: { role: 'driver' } },
      {
        $lookup: {
          from: 'driverprofiles',
          localField: 'googleId',
          foreignField: 'userId',
          as: 'profile'
        }
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          id: '$googleId',
          name: 1,
          email: 1,
          phone: 1,
          photoUrl: '$profile.profilePhoto',
          isAvailable: 1,
          createdAt: 1,
          profile: {
            licensePhoto: 1,
            profilePhoto: 1,
            licenseNumber: 1,
            licenseType: 1,
            experience: 1,
            location: 1,
            age: 1,
            gender: 1,
            knownTruckTypes: 1,
            verificationStatus: 1
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.status(200).json({ success: true, drivers });
  } catch (err) {
    console.error('Get drivers error:', err);
    res.status(500).json({ 
      success: false,
      error: "Server error", 
      details: err.message 
    });
  }
};

// Get all owners
const getAllOwners = async (req, res) => {
  try {
    const owners = await User.aggregate([
      { $match: { role: 'owner' } },
      {
        $lookup: {
          from: 'ownerprofiles',
          localField: 'googleId',
          foreignField: 'userId',
          as: 'profile'
        }
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          id: '$googleId',
          name: 1,
          email: 1,
          phone: 1,
          photoUrl: { $ifNull: ['$profile.photoUrl', ''] },
          createdAt: 1,
          profile: {
            companyName: 1,
            companyLocation: 1,
            gender: 1,
            companyInfoCompleted: 1,
            photoUrl: 1
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.status(200).json({ success: true, owners });
  } catch (err) {
    console.error('Get owners error:', err);
    res.status(500).json({ 
      success: false,
      error: "Server error", 
      details: err.message 
    });
  }
};

// Get verification stats
const getVerificationStats = async (req, res) => {
  try {
    const [pending, approved, rejected] = await Promise.all([
      VerificationRequest.countDocuments({ status: 'pending' }),
      VerificationRequest.countDocuments({ status: 'approved' }),
      VerificationRequest.countDocuments({ status: 'rejected' })
    ]);

    res.status(200).json({
      success: true,
      verificationStats: { pending, approved, rejected }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

module.exports = {
  initialLogin,
  adminLogin,
  changePassword,
  createNewAdmin,
  getDashboardData,
  getAllDrivers,
  getAllOwners,
  getVerificationStats
};