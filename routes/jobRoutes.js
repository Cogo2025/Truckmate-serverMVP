const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const jobController = require('../controllers/jobController');
const profileController = require('../controllers/profileController');

router.post('/', authMiddleware, jobController.createJob);
router.get('/', jobController.getJobs);
router.get('/owner', authMiddleware, jobController.getJobsByOwner);
router.get('/driver', authMiddleware, jobController.getJobsForDriver);
router.get('/filter-options', authMiddleware, jobController.getFilterOptions);
router.get('/:jobId', authMiddleware, jobController.getJobDetails);
router.get('/owner/:ownerId', authMiddleware, jobController.getJobsByOwnerId);
router.get('/owner/:ownerId/jobs', authMiddleware, profileController.getOwnerJobs);

module.exports = router;