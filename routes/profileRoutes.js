const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');
const jobController = require('../controllers/jobController');

// ✅ Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Setup multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});

// ✅ File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, JPG, PNG, GIF)'), false);
  }
};

// ✅ Configure multer for single file uploads
const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ✅ NEW: Configure multer for multiple file uploads (for driver profile)
const uploadMultiple = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per file
  }
});

// ✅ Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  
  if (err.message === 'Only image files are allowed (JPEG, JPG, PNG, GIF)') {
    return res.status(400).json({ error: err.message });
  }
  
  next(err);
};

// ✅ NEW: User info update route
router.patch('/user', authMiddleware, profileController.updateUserInfo);

// ✅ MODIFIED: Driver Profile Routes with multiple file upload support
router.get('/driver', authMiddleware, profileController.getDriverProfile);

// ✅ NEW: Driver profile creation with support for both license and profile photos
router.post('/driver', authMiddleware, uploadMultiple.fields([
  { name: 'licensePhoto', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 }
]), handleMulterError, profileController.createDriverProfile);
router.get('/driver/available', authMiddleware, profileController.getAvailableDrivers);

// ✅ NEW: Driver profile update with support for both license and profile photos
router.patch('/driver', authMiddleware, uploadMultiple.fields([
  { name: 'licensePhoto', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 }
]), handleMulterError, profileController.updateDriverProfile);
// Add this route in profileRoutes.js
router.patch('/availability', authMiddleware, profileController.updateAvailability);
// ✅ Owner Profile Routes (unchanged)
router.get('/owner', authMiddleware, profileController.getOwnerProfile);
router.post('/owner', authMiddleware, upload.single('photo'), handleMulterError, profileController.createOwnerProfile);
router.patch('/owner', authMiddleware, upload.single('photo'), handleMulterError, profileController.updateOwnerProfile);
router.get('/owner/:ownerId', authMiddleware, profileController.getOwnerProfileById);
router.get('/owner/:ownerId/jobs', authMiddleware, jobController.getJobsByOwnerId);
router.get('/driver/check-completion', authMiddleware, profileController.checkProfileCompletion);

// ✅ Delete profile photo route (supports both license and profile photos)
router.delete('/photo', authMiddleware, profileController.deleteProfilePhoto);

// ✅ Test routes
router.get('/test-image/:filename', profileController.testImageAccess);

// Test route to list all uploaded files
router.get('/test-uploads', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '../uploads');
    const files = fs.readdirSync(uploadsDir);
    
    const fileList = files.map(file => ({
      filename: file,
      url: `${process.env.BASE_URL || 'http://192.168.29.138:5000'}/uploads/${file}`,
      path: path.join(uploadsDir, file)
    }));
    
    res.json({
      success: true,
      message: `Found ${files.length} files`,
      files: fileList,
      baseUrl: process.env.BASE_URL || 'http://192.168.29.138:5000'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ 
    message: 'Profile routes are working',
    timestamp: new Date().toISOString(),
    baseUrl: process.env.BASE_URL || 'http://192.168.29.138:5000'
  });
});

module.exports = router;