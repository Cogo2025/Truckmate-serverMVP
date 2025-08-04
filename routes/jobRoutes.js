const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const jobController = require('../controllers/jobController');
const profileController = require('../controllers/profileController');

// New: Multer for file uploads
const multer = require('multer');
const path = require('path');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

router.post('/', authMiddleware, jobController.createJob);
router.get('/', jobController.getJobs);
router.get('/owner', authMiddleware, jobController.getJobsByOwner);
router.get('/driver', authMiddleware, jobController.getJobsForDriver);
router.get('/filter-options', authMiddleware, jobController.getFilterOptions);
router.get('/:jobId', authMiddleware, jobController.getJobDetails);
router.get('/owner/:ownerId', authMiddleware, jobController.getJobsByOwnerId);
router.get('/owner/:ownerId/jobs', authMiddleware, profileController.getOwnerJobs);
// Add this line after the other routes
router.delete('/:jobId', authMiddleware, jobController.deleteJob);

// New: Update job (PATCH)
router.patch('/:jobId', authMiddleware, jobController.updateJob);

// New: Upload photos to job (handles multiple files)
router.post('/:jobId/photos', authMiddleware, upload.array('lorryPhotos', 10), jobController.uploadJobPhotos); // Limit to 10 files

module.exports = router;
