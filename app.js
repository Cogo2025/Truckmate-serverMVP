const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Proper static file serving configuration
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1d', // Cache images for 1 day
  etag: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));

// Test route to verify uploads directory access
app.get('/test-upload', (req, res) => {
  const testFilePath = path.join(uploadsDir, 'test.jpg');
  
  res.send(`
    <h2>Upload Directory Test</h2>
    <p>Uploads directory: ${uploadsDir}</p>
    <p>Try accessing: <a href="/uploads/test.jpg">/uploads/test.jpg</a></p>
    <p>Make sure you have a test.jpg file in your uploads directory.</p>
  `);
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/likes', require('./routes/likeRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes')); // Make sure this is added

module.exports = app;