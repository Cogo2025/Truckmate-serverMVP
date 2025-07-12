const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const likeController = require('../controllers/likeController');

// Like a job
router.post('/', authMiddleware, likeController.likeItem);

// Unlike a job
router.delete('/:likedItemId', authMiddleware, likeController.unlikeItem);

// Get all liked jobs by current user
router.get('/user', authMiddleware, likeController.getUserLikes);

// Check if current user liked a specific job
router.get('/check', authMiddleware, likeController.checkUserLike);

module.exports = router;