const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Enhanced file filter with better logging
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  console.log('Incoming file:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    extension: fileExt
  });

  if (
    allowedTypes.includes(file.mimetype) ||
    ['.jpeg', '.jpg', '.png', '.webp'].includes(fileExt)
  ) {
    cb(null, true);
  } else {
    console.error('Rejected file type:', file.mimetype);
    cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} are allowed.`), false);
  }
};

// Configure multer with better error handling
const upload = multer({ 
  storage,
  fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Max 10 files
  }
}).array('images');

const uploadImages = async (req, res) => {
  try {
    upload(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ 
          error: err.message || 'File upload failed',
          details: err 
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files were uploaded' });
      }

      // Generate proper URLs (works for both HTTP and HTTPS)
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;

      const fileUrls = req.files.map(file => {
        return `${baseUrl}/uploads/${file.filename}`;
      });

      res.status(200).json({ 
        success: true,
        count: fileUrls.length,
        urls: fileUrls 
      });
    });
  } catch (err) {
    console.error('Unexpected upload error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
};


module.exports = { uploadImages };