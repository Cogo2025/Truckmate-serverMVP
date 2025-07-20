const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const uploadController = require('../controllers/uploadController');

router.post('/', authMiddleware, uploadController.uploadImages);

module.exports = router;