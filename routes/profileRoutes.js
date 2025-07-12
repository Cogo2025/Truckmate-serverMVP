const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');
const jobController = require('../controllers/jobController'); // Add this line

router.get('/driver', authMiddleware, profileController.getDriverProfile);
router.post('/driver', authMiddleware, profileController.createDriverProfile);
router.patch('/driver', authMiddleware, profileController.updateDriverProfile);
router.post('/owner', authMiddleware, profileController.createOwnerProfile);
router.get('/owner', authMiddleware, profileController.getOwnerProfile);
router.get('/owner/:ownerId/jobs', authMiddleware, jobController.getJobsByOwnerId);
router.get('/owner/:ownerId', authMiddleware, profileController.getOwnerProfileById);

module.exports = router;