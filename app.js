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

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Alternative: More explicit setup
app.use('/uploads', express.static('uploads', {
  maxAge: '1d', // Cache images for 1 day
  etag: true
}));

// ✅ Add a test route to verify static serving works
app.get('/test-upload', (req, res) => {
  res.send(`
    <h2>Test Upload Access</h2>
    <p>Try accessing: <a href="/uploads/test.jpg">/uploads/test.jpg</a></p>
    <p>Base URL: ${process.env.BASE_URL || 'http://localhost:3000'}</p>
  `);
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/likes', require('./routes/likeRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

module.exports = app;
