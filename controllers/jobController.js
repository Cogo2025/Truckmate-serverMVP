// jobController.js
const JobPost = require('../models/JobPost');
const DriverProfile = require('../models/DriverProfile');
const Like = require('../models/Like');
const User = require('../models/User');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const { Readable } = require('stream');

// ==================== FILE UPLOAD CONFIGURATION ====================

// Use multer memory storage (saves files in memory as buffers)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ==================== CLOUDINARY HELPERS ====================

// Helper to upload buffer to Cloudinary for jobs
const uploadBufferToCloudinaryJob = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'truckmate/jobs',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
        transformation: [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );

    // Create readable stream from buffer
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

// Helper function to delete job images from Cloudinary
const deleteJobImages = async (imageUrls) => {
  try {
    if (!imageUrls || imageUrls.length === 0) return;
    
    for (const imageUrl of imageUrls) {
      if (!imageUrl || imageUrl === '') continue;
      
      // Extract public_id from Cloudinary URL
      const parts = imageUrl.split('/');
      const filename = parts[parts.length - 1];
      const publicId = filename.split('.')[0];
      const folder = parts.slice(-2, -1)[0];
      const fullPublicId = `${folder}/${publicId}`;
      
      await cloudinary.uploader.destroy(fullPublicId);
    }
  } catch (error) {
    console.error('Error deleting Cloudinary images:', error);
  }
};

// Helper to process uploaded job photos
const processJobPhotos = async (files) => {
  if (!files || files.length === 0) return [];
  
  const uploadPromises = files.map(file => 
    uploadBufferToCloudinaryJob(file.buffer)
  );
  
  return await Promise.all(uploadPromises);
};

// ==================== JOB CONTROLLERS ====================

// Create job
const createJob = async (req, res) => {
  try {
    let lorryPhotos = [];
    
    // Process uploaded files if they exist
    if (req.files && req.files.length > 0) {
      lorryPhotos = await processJobPhotos(req.files);
    }
    
    // Also check if photos are provided in request body (for backward compatibility)
    if (req.body.lorryPhotos) {
      try {
        const bodyPhotos = typeof req.body.lorryPhotos === 'string' 
          ? JSON.parse(req.body.lorryPhotos) 
          : req.body.lorryPhotos;
        
        if (Array.isArray(bodyPhotos)) {
          lorryPhotos = [...lorryPhotos, ...bodyPhotos];
        }
      } catch (e) {
        console.log('Error parsing lorryPhotos from body:', e);
      }
    }

    // Check if we have at least one photo
    if (lorryPhotos.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: "At least one photo is required" 
      });
    }

    const job = await JobPost.create({
      truckType: req.body.truckType,
      variant: {
        type: req.body.variant?.type,
        wheelsOrFeet: req.body.variant?.wheelsOrFeet
      },
      sourceLocation: req.body.sourceLocation,
      experienceRequired: req.body.experienceRequired,
      dutyType: req.body.dutyType,
      salaryType: req.body.salaryType,
      salaryRange: {
        min: req.body.salaryRange?.min,
        max: req.body.salaryRange?.max
      },
      description: req.body.description,
      phone: req.body.phone,
      lorryPhotos: lorryPhotos,
      ownerId: req.userId
    });

    res.status(201).json({
      success: true,
      data: job
    });
  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Delete job
const deleteJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid job ID format" 
      });
    }

    const job = await JobPost.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found' 
      });
    }

    if (job.ownerId !== req.userId) {
      return res.status(403).json({ 
        success: false,
        error: 'You are not authorized to delete this job' 
      });
    }

    // Delete images from Cloudinary first
    await deleteJobImages(job.lorryPhotos);

    await JobPost.findByIdAndDelete(jobId);
    
    await Like.deleteMany({
      likedItemId: jobId,
      likedType: 'job'
    });

    res.status(200).json({ 
      success: true,
      message: 'Job deleted successfully' 
    });
    
  } catch (err) {
    console.error('Error in deleteJob:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Upload images for jobs
const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: "No files uploaded" 
      });
    }
    
    const urls = await processJobPhotos(req.files);
    res.status(200).json({ 
      success: true,
      urls 
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Update job
const updateJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await JobPost.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found' 
      });
    }
    
    if (job.ownerId !== req.userId) {
      return res.status(403).json({ 
        success: false,
        error: 'You are not authorized to update this job' 
      });
    }

    // Handle new image uploads
    let newPhotoUrls = [];
    if (req.files && req.files.length > 0) {
      newPhotoUrls = await processJobPhotos(req.files);
    }

    // Combine existing photos with new ones
    const updatedLorryPhotos = [
      ...(job.lorryPhotos || []),
      ...newPhotoUrls
    ];

    // Update job with new data
    const updatedJob = await JobPost.findByIdAndUpdate(
      jobId,
      {
        ...req.body,
        lorryPhotos: updatedLorryPhotos
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedJob
    });
  } catch (err) {
    console.error('Error in updateJob:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get all jobs
const getJobs = async (req, res) => {
  try {
    const jobs = await JobPost.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: 'googleId',
          as: 'owner'
        }
      },
      {
        $addFields: {
          ownerName: { $arrayElemAt: ['$owner.name', 0] },
          ownerPhoto: { $arrayElemAt: ['$owner.photoUrl', 0] }
        }
      },
      {
        $project: {
          owner: 0
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: jobs
    });
  } catch (err) {
    console.error('Error in getJobs:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get jobs by owner (current user)
const getJobsByOwner = async (req, res) => {
  try {
    const jobs = await JobPost.find({ ownerId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: jobs
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get jobs for driver with filters
const getJobsForDriver = async (req, res) => {
  try {
    const filters = {};
    
    console.log('Incoming query params:', req.query);

    if (Object.keys(req.query).length > 0) {
      if (req.query.truckType) {
        filters.truckType = req.query.truckType;
      }
      
      if (req.query.sourceLocation) {
        filters.sourceLocation = { 
          $regex: new RegExp(`^${req.query.sourceLocation}$`, 'i') 
        };
      }
      
      if (req.query.minSalary || req.query.maxSalary) {
        filters.$and = [];
        
        if (req.query.minSalary) {
          filters.$and.push({
            $or: [
              { 'salaryRange.min': { $gte: parseInt(req.query.minSalary) } },
              { 'salaryRange.max': { $gte: parseInt(req.query.minSalary) } }
            ]
          });
        }
        
        if (req.query.maxSalary) {
          filters.$and.push({
            $or: [
              { 'salaryRange.min': { $lte: parseInt(req.query.maxSalary) } },
              { 'salaryRange.max': { $lte: parseInt(req.query.maxSalary) } }
            ]
          });
        }
      }
      
      if (req.query.variantType) {
        filters['variant.type'] = req.query.variantType;
      }
      
      if (req.query.wheelsOrFeet) {
        filters['variant.wheelsOrFeet'] = req.query.wheelsOrFeet;
      }
      
      if (req.query.experienceRequired) {
        filters.experienceRequired = req.query.experienceRequired;
      }
      
      if (req.query.dutyType) {
        filters.dutyType = req.query.dutyType;
      }
      
      if (req.query.salaryType) {
        filters.salaryType = req.query.salaryType;
      }
    }
    
    console.log('Final filters:', JSON.stringify(filters, null, 2));
    
    const jobs = await JobPost.aggregate([
      { $match: filters },
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: 'googleId',
          as: 'owner'
        }
      },
      {
        $addFields: {
          ownerName: { $arrayElemAt: ['$owner.name', 0] },
          ownerPhoto: { $arrayElemAt: ['$owner.photoUrl', 0] }
        }
      },
      {
        $project: {
          owner: 0
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: req.query.limit ? parseInt(req.query.limit) : 100 }
    ]);
    
    res.status(200).json({
      success: true,
      data: jobs
    });
  } catch (err) {
    console.error('Error in getJobsForDriver:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch jobs',
      details: err.message 
    });
  }
};

// Get filter options
const getFilterOptions = async (req, res) => {
  try {
    const [
      truckTypes,
      locations,
      salaryRanges,
      variantTypes,
      wheelsOrFeetOptions,
      experienceOptions,
      dutyTypes,
      salaryTypes
    ] = await Promise.all([
      JobPost.distinct('truckType').then(types => [...new Set(types)]),
      JobPost.distinct('sourceLocation'),
      JobPost.find({}, { salaryRange: 1, _id: 0 }),
      JobPost.distinct('variant.type'),
      JobPost.distinct('variant.wheelsOrFeet'),
      JobPost.distinct('experienceRequired'),
      JobPost.distinct('dutyType'),
      JobPost.distinct('salaryType')
    ]);
    
    let minSalary = 0;
    let maxSalary = 100000;
    
    if (salaryRanges.length > 0) {
      const salaries = salaryRanges
        .filter(job => job.salaryRange)
        .map(job => [job.salaryRange.min, job.salaryRange.max])
        .flat()
        .filter(salary => salary != null);
      
      if (salaries.length > 0) {
        minSalary = Math.min(...salaries);
        maxSalary = Math.max(...salaries);
      }
    }
    
    const allWheelsOptions = await JobPost.distinct('variant.wheelsOrFeet');
    const bodyVehicleWheels = ["6 wheels", "8 wheels", "12 wheels", "14 wheels", "16 wheels"];
    const otherWheelsOptions = allWheelsOptions.filter(opt => 
      !bodyVehicleWheels.includes(opt)
    );
    
    res.status(200).json({
      success: true,
      data: {
        truckTypes: truckTypes.filter(Boolean),
        locations: locations.filter(Boolean),
        salaryRange: { min: minSalary, max: maxSalary },
        variantTypes: variantTypes.filter(Boolean),
        wheelsOrFeetOptions: wheelsOrFeetOptions.filter(Boolean),
        experienceOptions: experienceOptions.filter(Boolean),
        dutyTypes: dutyTypes.filter(Boolean),
        salaryTypes: salaryTypes.filter(Boolean),
        bodyVehicleWheels: bodyVehicleWheels,
        otherWheelsOptions: otherWheelsOptions.filter(Boolean),
      }
    });
  } catch (err) {
    console.error('Error in getFilterOptions:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get jobs by owner ID
const getJobsByOwnerId = async (req, res) => {
  try {
    const jobs = await JobPost.find({ ownerId: req.params.ownerId });
    res.status(200).json({
      success: true,
      data: jobs
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get job details
const getJobDetails = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.jobId)) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid job ID format" 
      });
    }

    const jobs = await JobPost.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.jobId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: 'googleId',
          as: 'owner'
        }
      },
      {
        $addFields: {
          ownerName: { $arrayElemAt: ['$owner.name', 0] },
          ownerPhoto: { $arrayElemAt: ['$owner.photoUrl', 0] }
        }
      },
      {
        $project: {
          owner: 0
        }
      }
    ]);

    if (!jobs || jobs.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: "Job not found" 
      });
    }

    const job = jobs[0];

    const likeCount = await Like.countDocuments({
      likedItemId: job._id.toString(),
      likedType: 'job'
    });

    let isLiked = false;
    if (req.userId) {
      const userLike = await Like.findOne({
        likedBy: req.userId,
        likedItemId: job._id.toString(),
        likedType: 'job'
      });
      isLiked = !!userLike;
    }

    res.status(200).json({
      success: true,
      data: {
        ...job,
        likeCount,
        isLiked
      }
    });
  } catch (err) {
    console.error("Error fetching job details:", err);
    res.status(500).json({ 
      success: false,
      error: "Server error",
      details: err.message 
    });
  }
};

// Upload job photos
const uploadJobPhotos = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await JobPost.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found' 
      });
    }
    
    if (job.ownerId !== req.userId) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized' 
      });
    }
    
    const newPhotos = await processJobPhotos(req.files);
    
    job.lorryPhotos = [...(job.lorryPhotos || []), ...newPhotos];
    await job.save();
    
    res.status(200).json({ 
      success: true,
      message: 'Photos uploaded', 
      lorryPhotos: job.lorryPhotos 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// ==================== EXPORTS ====================

module.exports = {
  createJob,
  getJobs,
  getJobsByOwner,
  getJobsForDriver,
  getFilterOptions,
  getJobsByOwnerId,
  getJobDetails,
  updateJob,
  uploadJobPhotos,
  deleteJob,
  upload,
  uploadImages
};