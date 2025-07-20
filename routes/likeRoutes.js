// likeRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const likeController = require('../controllers/likeController');

// UPDATED: Fixed route structure to match what Flutter expects

// Job likes - matches what Flutter is calling
router.post('/', authMiddleware, likeController.likeItem);  // POST /api/likes
router.delete('/:likedItemId', authMiddleware, likeController.unlikeItem);  // DELETE /api/likes/:id
router.get('/user', authMiddleware, likeController.getUserLikes);  // GET /api/likes/user
router.get('/check', authMiddleware, likeController.checkUserLike);  // GET /api/likes/check

// Alternative job routes (more specific)
router.post('/job', authMiddleware, likeController.likeItem);
router.delete('/job/:likedItemId', authMiddleware, likeController.unlikeItem);
router.get('/job/user', authMiddleware, likeController.getUserLikes);
router.get('/job/check', authMiddleware, likeController.checkUserLike);

// Driver likes
router.post('/driver', authMiddleware, likeController.likeDriver);
router.delete('/driver/:driverId', authMiddleware, likeController.unlikeDriver);
router.get('/driver/user', authMiddleware, likeController.getOwnerLikedDrivers);
router.get('/driver/check', authMiddleware, likeController.checkDriverLike);

module.exports = router;