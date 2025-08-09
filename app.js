const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');
const adminRoutes = require('./routes/adminRoutes');

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

app.get('/', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>TruckMate Server</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-width: 600px;
          margin: 0 auto;
        }
        h1 {
          color: #2c3e50;
        }
        .status {
          color: #27ae60;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>TruckMate Server</h1>
        <p class="status">✅ Server is running successfully</p>
        <p>Deployed on Render: ${process.env.NODE_ENV || 'development'} environment</p>
        <p>Current time: ${new Date().toLocaleString()}</p>
        <h3>Available API Routes:</h3>
        <ul style="text-align: left; display: inline-block;">
          <li><code>/api/auth</code> - Authentication endpoints</li>
          <li><code>/api/profile</code> - Profile management</li>
          <li><code>/api/jobs</code> - Job operations</li>
          <li><code>/api/uploads</code> - File uploads</li>
          <li><code>/api/admin</code> - Admin endpoints</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

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
app.use('/api/admin', adminRoutes);
const verificationRoutes = require('./routes/verificationRoutes'); // ✅ Import happens AFTER usage
app.use('/api/verification', require('./routes/verificationRoutes'));


module.exports = app;