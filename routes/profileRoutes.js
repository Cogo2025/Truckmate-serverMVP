// profileRoutes.js - Updated for Cloudinary storage
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');
const jobController = require('../controllers/jobController');

// Import multer configurations from controller
const {
  uploadDriverFiles,
  uploadOwnerProfile,
  createDriverProfile,
  createOwnerProfile,
  getDriverProfile,
  getOwnerProfile,
  updateDriverProfile,
  updateOwnerProfile,
  getOwnerProfileById,
  getOwnerJobs,
  deleteProfilePhoto,
  testImageAccess,
  updateUserInfo,
  checkProfileCompletion,
  updateAvailability,
  getAvailableDrivers
} = profileController;

// ============================================
// DRIVER PROFILE ROUTES
// ============================================

// Create driver profile with Cloudinary file upload (profile + license photos)
router.post(
  '/driver',
  authMiddleware,
  uploadDriverFiles, // Handles both profilePhoto and licensePhoto
  createDriverProfile
);

// Update driver profile with Cloudinary file upload
router.patch(
  '/driver',
  authMiddleware,
  uploadDriverFiles, // Handles both profilePhoto and licensePhoto
  updateDriverProfile
);

// Get driver profile
router.get('/driver', authMiddleware, getDriverProfile);

// Check driver profile completion
router.get('/driver/check-completion', authMiddleware, checkProfileCompletion);

// Get available drivers (with filters)
router.get('/driver/available', authMiddleware, getAvailableDrivers);

// ============================================
// OWNER PROFILE ROUTES
// ============================================

// Create owner profile with Cloudinary photo upload
router.post(
  '/owner',
  authMiddleware,
  uploadOwnerProfile.single('photo'), // Single file upload for owner profile photo
  createOwnerProfile
);

// Update owner profile with Cloudinary photo upload
router.patch(
  '/owner',
  authMiddleware,
  uploadOwnerProfile.single('photo'), // Single file upload for owner profile photo
  updateOwnerProfile
);

// Get owner profile
router.get('/owner', authMiddleware, getOwnerProfile);

// Get owner profile by ID (public route for viewing other owners)
router.get('/owner/:ownerId', authMiddleware, getOwnerProfileById);

// Get jobs posted by specific owner
router.get('/owner/:ownerId/jobs', authMiddleware, getOwnerJobs);

// ============================================
// USER INFO ROUTES
// ============================================

// Update user basic information (name, phone)
router.patch('/user', authMiddleware, updateUserInfo);

// Update user availability status
router.patch('/availability', authMiddleware, updateAvailability);

// ============================================
// PHOTO MANAGEMENT ROUTES
// ============================================

// Delete profile photo (for both driver and owner)
router.delete('/photo', authMiddleware, deleteProfilePhoto);

// Test image access (for debugging)
router.get('/test-image/:filename', testImageAccess);

// ============================================
// HEALTH CHECK & DEBUG ROUTES
// ============================================

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    message: 'Profile routes are working with Cloudinary support',
    timestamp: new Date().toISOString(),
    mode: 'Cloudinary Storage',
    baseUrl: process.env.BASE_URL || 'http://localhost:5000',
    cloudinary: {
      configured: !!process.env.CLOUDINARY_CLOUD_NAME,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'Not configured'
    }
  });
});

// Test route for debugging authentication
router.get('/test', authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Profile routes are working correctly with Cloudinary',
    user: req.userId,
    timestamp: new Date().toISOString(),
    authenticationWorking: true
  });
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// Handle multer errors (file upload errors)
router.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'File size must be less than 5MB'
    });
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'Too many files',
      message: 'Maximum 2 files allowed (profile photo and license photo)'
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected field',
      message: 'Only profilePhoto and licensePhoto fields are allowed'
    });
  }
  
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only JPEG, JPG, PNG, and GIF files are allowed'
    });
  }
  
  // Pass other errors to the default error handler
  next(error);
});

// ============================================
// ROUTE DOCUMENTATION (for development)
// ============================================

// GET route for API documentation (only in development)
if (process.env.NODE_ENV === 'development') {
  router.get('/docs', (req, res) => {
    res.json({
      title: 'Profile API Documentation',
      version: '2.0.0 (Cloudinary)',
      routes: {
        driver: {
          'POST /driver': 'Create driver profile with photos (multipart/form-data)',
          'PATCH /driver': 'Update driver profile with photos (multipart/form-data)',
          'GET /driver': 'Get current driver profile',
          'GET /driver/check-completion': 'Check if driver profile is complete',
          'GET /driver/available': 'Get available drivers with filters'
        },
        owner: {
          'POST /owner': 'Create owner profile with photo (multipart/form-data)',
          'PATCH /owner': 'Update owner profile with photo (multipart/form-data)',
          'GET /owner': 'Get current owner profile',
          'GET /owner/:ownerId': 'Get owner profile by ID',
          'GET /owner/:ownerId/jobs': 'Get jobs posted by owner'
        },
        user: {
          'PATCH /user': 'Update user basic info (JSON)',
          'PATCH /availability': 'Update user availability status (JSON)'
        },
        photos: {
          'DELETE /photo': 'Delete profile photo',
          'GET /test-image/:filename': 'Test image access'
        },
        system: {
          'GET /health': 'Health check',
          'GET /test': 'Test authentication',
          'GET /docs': 'API documentation (dev only)'
        }
      },
      fileUpload: {
        maxSize: '5MB',
        allowedFormats: ['jpg', 'jpeg', 'png', 'gif'],
        cloudinaryFolders: {
          drivers: {
            profiles: 'truckmate/drivers/profiles',
            licenses: 'truckmate/drivers/licenses'
          },
          owners: {
            profiles: 'truckmate/owners/profiles'
          }
        }
      }
    });
  });
}

module.exports = router;
