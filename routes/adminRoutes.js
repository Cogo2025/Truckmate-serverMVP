const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

// Public routes
router.post('/initial-login', adminController.initialLogin);
router.post('/login', adminController.adminLogin);

// Protected routes
router.post('/change-password', adminAuth, adminController.changePassword);
router.post('/create-admin', adminAuth, adminController.createNewAdmin);
router.get('/dashboard', adminAuth, adminController.getDashboardData);
router.get('/drivers', adminAuth, adminController.getAllDrivers);
router.get('/owners', adminAuth, adminController.getAllOwners);
router.get('/verification-stats', adminAuth, adminController.getVerificationStats);
module.exports = router;
