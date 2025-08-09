const User = require('../models/User');
const Admin = require('../models/admin');
const DriverProfile = require('../models/DriverProfile');
const OwnerProfile = require('../models/OwnerProfile');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const VerificationRequest = require('../models/VerificationRequest'); // ✅ ADD THIS LINE

// Generate JWT token
const generateToken = (adminId) => {
  return jwt.sign({ adminId, isAdmin: true }, process.env.JWT_SECRET, { 
    expiresIn: '8h' 
  });
};

// Initial admin login (first time setup)
const initialLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if any admin exists
    const adminCount = await Admin.countDocuments();
    
    if (adminCount > 0) {
      return res.status(403).json({
        error: "Unauthorized access. Admin account already exists."
      });
    }
    
    // Check credentials for first admin
    if (username !== '123user' || password !== '123user') {
      return res.status(401).json({
        error: "Invalid credentials for initial setup"
      });
    }
    
    // Create first admin account
    const firstAdmin = await Admin.create({
      username: '123user',
      password: '123user',
      isFirstLogin: true
    });
    
    const token = generateToken(firstAdmin._id);
    
    res.status(200).json({
      success: true,
      message: "First admin created. Please change your password.",
      token,
      admin: {
        id: firstAdmin._id,
        username: firstAdmin.username,
        isFirstLogin: true
      }
    });
    
  } catch (err) {
    console.error('Initial login error:', err);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
};

// Admin login
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find admin
    const admin = await Admin.findOne({ username, isActive: true });
    if (!admin) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }
    
    // Check password
    const isPasswordCorrect = await admin.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }
    
    // Update last login
    admin.lastLogin = new Date();
    await admin.save();
    
    const token = generateToken(admin._id);
   res.status(200).json({
  success: true,
  message: "Login successful",
  token,
  admin: {
    id: admin._id,
    username: admin.username,
    isFirstLogin: !!admin.isFirstLogin, // Force boolean
    lastLogin: admin.lastLogin
  }
});
    
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.adminId;
    
    // Validation
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: "New password must be at least 6 characters long"
      });
    }
    
    // Find admin
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        error: "Admin not found"
      });
    }
    
    // Check current password (unless it's first login)
    if (!admin.isFirstLogin) {
      const isCurrentPasswordCorrect = await admin.comparePassword(currentPassword);
      if (!isCurrentPasswordCorrect) {
        return res.status(401).json({
          error: "Current password is incorrect"
        });
      }
    }
    
    // Update password
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
    
    // Validation
    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required"
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long"
      });
    }
    
    // Check if username already exists
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({
        error: "Username already exists"
      });
    }
    
    // Create new admin
    const newAdmin = await Admin.create({
      username,
      password,
      createdBy,
      isFirstLogin: true
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
      error: "Server error", 
      details: err.message 
    });
  }
};

const getDashboardData = async (req, res) => {
  try {
    // Recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get verification stats
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

    // Get user counts
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
      {
        $unwind: {
          path: '$profile',
          preserveNullAndEmptyArrays: true
        }
      },
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
            knownTruckTypes: 1
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);
    
    res.status(200).json({
      success: true,
      drivers
    });
    
  } catch (err) {
    console.error('Get drivers error:', err);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
};

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
      {
        $unwind: {
          path: '$profile',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          id: '$googleId',
          name: 1,
          email: 1,
          phone: 1,
          photoUrl: {
            $ifNull: ['$profile.photoUrl', '']
          },
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
    
    res.status(200).json({
      success: true,
      owners
    });
  } catch (err) {
    console.error('Get owners error:', err);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
};


const getVerificationStats = async (req, res) => {
  try {
    const VerificationRequest = require('../models/VerificationRequest');
    
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
    res.status(500).json({ error: err.message });
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
