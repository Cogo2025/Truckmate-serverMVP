const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const jobController = require('../controllers/jobController');

// Image upload route (separate from job creation)
router.post(
  '/upload-images',
  authMiddleware,
  jobController.upload.array('images', 10),
  jobController.uploadImages
);

// Job creation route - REMOVED FILE UPLOAD MIDDLEWARE
router.post(
  '/',
  authMiddleware,
  jobController.createJob  // No upload middleware here!
);

// Job retrieval routes
router.get('/', jobController.getJobs);
router.get('/owner', authMiddleware, jobController.getJobsByOwner);
router.get('/driver', authMiddleware, jobController.getJobsForDriver);
router.get('/filter-options', jobController.getFilterOptions);
router.get('/:jobId', jobController.getJobDetails);
router.get('/owner/:ownerId', authMiddleware, jobController.getJobsByOwnerId);

// Job modification routes
router.patch(
  '/:jobId',
  authMiddleware,
  jobController.upload.array('lorryPhotos', 10),
  jobController.updateJob
);

router.delete('/:jobId', authMiddleware, jobController.deleteJob);



module.exports = router;