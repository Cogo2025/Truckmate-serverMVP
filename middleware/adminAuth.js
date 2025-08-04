const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: "Access denied. No token provided."
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.isAdmin) {
      return res.status(403).json({
        error: "Access denied. Admin privileges required."
      });
    }
    
    const admin = await Admin.findById(decoded.adminId);
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        error: "Invalid token or admin account deactivated."
      });
    }
    
    req.adminId = decoded.adminId;
    next();
    
  } catch (err) {
    console.error('Admin auth error:', err);
    res.status(401).json({
      error: "Invalid token."
    });
  }
};

module.exports = adminAuth;
