// profileRoutes.js - Updated for Cloudinary storage
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');
const jobController = require('../controllers/jobController');

// Destructure functions safely from profileController
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

// Helper to check undefined controllers
const safeHandler = (fnName) => {
  if (typeof profileController[fnName] !== 'function') {
    return (req, res) => {
      console.error(`⚠ Missing controller function: ${fnName}`);
      return res.status(500).json({
        error: `Internal server error: Missing controller function "${fnName}"`
      });
    };
  }
  return profileController[fnName];
};

// ============================================
// DRIVER PROFILE ROUTES
// ============================================

// Create driver profile with Cloudinary file upload
router.post(
  '/driver',
  authMiddleware,
  uploadDriverFiles,
  safeHandler('createDriverProfile')
);

// Update driver profile with Cloudinary file upload
router.patch(
  '/driver',
  authMiddleware,
  uploadDriverFiles,
  safeHandler('updateDriverProfile')
);

// Get driver profile
router.get('/driver', authMiddleware, safeHandler('getDriverProfile'));

// Check driver profile completion
router.get('/driver/check-completion', authMiddleware, safeHandler('checkProfileCompletion'));

// Get available drivers
router.get('/driver/available', authMiddleware, safeHandler('getAvailableDrivers'));

// ============================================
// OWNER PROFILE ROUTES
// ============================================

// Create owner profile
router.post(
  '/owner',
  authMiddleware,
  uploadOwnerProfile.single('photo'),
  safeHandler('createOwnerProfile')
);

// Update owner profile
router.patch(
  '/owner',
  authMiddleware,
  uploadOwnerProfile.single('photo'),
  safeHandler('updateOwnerProfile')
);

// Get owner profile
router.get('/owner', authMiddleware, safeHandler('getOwnerProfile'));

// Get owner profile by ID
router.get('/owner/:ownerId', authMiddleware, safeHandler('getOwnerProfileById'));

// Get jobs posted by owner
router.get('/owner/:ownerId/jobs', authMiddleware, safeHandler('getOwnerJobs'));

// ============================================
// USER INFO ROUTES
// ============================================

// Update user basic information
router.patch('/user', authMiddleware, safeHandler('updateUserInfo'));

// Update user availability status
router.patch('/availability', authMiddleware, safeHandler('updateAvailability'));

// ============================================
// PHOTO MANAGEMENT ROUTES
// ============================================

// Delete profile photo
router.delete('/photo', authMiddleware, safeHandler('deleteProfilePhoto'));

// Test image access
router.get('/test-image/:filename', safeHandler('testImageAccess'));

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
// ROUTE DOCUMENTATION (development mode)
// ============================================

if (process.env.NODE_ENV === 'development') {
  router.get('/docs', (req, res) => {
    res.json({
      title: 'Profile API Documentation',
      version: '2.0.0 (Cloudinary)',
      routes: {
        driver: {
          'POST /driver': 'Create driver profile with photos',
          'PATCH /driver': 'Update driver profile with photos',
          'GET /driver': 'Get current driver profile',
          'GET /driver/check-completion': 'Check driver profile completion',
          'GET /driver/available': 'Get available drivers'
        },
        owner: {
          'POST /owner': 'Create owner profile with photo',
          'PATCH /owner': 'Update owner profile with photo',
          'GET /owner': 'Get current owner profile',
          'GET /owner/:ownerId': 'Get owner profile by ID',
          'GET /owner/:ownerId/jobs': 'Get jobs posted by owner'
        },
        user: {
          'PATCH /user': 'Update user basic info',
          'PATCH /availability': 'Update user availability status'
        },
        photos: {
          'DELETE /photo': 'Delete profile photo',
          'GET /test-image/:filename': 'Test image access'
        },
        system: {
          'GET /health': 'Health check',
          'GET /test': 'Test authentication',
          'GET /docs': 'API documentation'
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
