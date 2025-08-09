// routes/verificationRoutes.js - Enhanced version
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const adminAuth = require('../middleware/adminAuth');
const verificationController = require('../controllers/verificationController');
// Driver routes
router.post('/request', authMiddleware, verificationController.createVerificationRequest);
router.get('/status', authMiddleware, verificationController.getDriverVerificationStatus); // New
router.get('/check-access', authMiddleware, verificationController.checkDriverAccess); // New
router.post('/resubmit', authMiddleware, verificationController.resubmitVerification); // New
// Admin routes
router.get('/pending', adminAuth, verificationController.getPendingVerifications);
router.patch('/:requestId/process', adminAuth, verificationController.processVerification);
router.get('/stats', adminAuth, verificationController.getVerificationStats);
router.get('/all', adminAuth, verificationController.getAllVerifications);
module.exports = router;
