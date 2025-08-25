const JobPost = require('../models/JobPost');
const DriverProfile = require('../models/DriverProfile');
const Like = require('../models/Like');
const User = require('../models/User');
const mongoose = require('mongoose');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');

// Cloudinary storage configuration for job photos
const jobPhotosStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    return {
      folder: 'truckmate/jobs',
      format: 'jpg',
      public_id: `${req.userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      transformation: [
        { width: 800, height: 600, crop: 'limit' },
        { quality: 'auto' }
      ]
    };
  }
});

const upload = multer({
  storage: jobPhotosStorage,
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

// Helper function to delete job images from Cloudinary
const deleteJobImages = async (imageUrls) => {
  try {
    if (!imageUrls || imageUrls.length === 0) return;
    
    for (const imageUrl of imageUrls) {
      if (!imageUrl) continue;
      
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

// Update createJob function to use Cloudinary
// jobController.js - Update createJob function
const createJob = async (req, res) => {
  try {
    // Check if lorryPhotos array exists and has at least one URL
    if (!req.body.lorryPhotos || req.body.lorryPhotos.length === 0) {
      return res.status(400).json({ error: "At least one photo is required" });
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
      lorryPhotos: req.body.lorryPhotos, // Use the Cloudinary URLs from request body
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
// Update deleteJob function to clean up images
const deleteJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: "Invalid job ID format" });
    }

    const job = await JobPost.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.ownerId !== req.userId) {
      return res.status(403).json({ error: 'You are not authorized to delete this job' });
    }

    // Delete images from Cloudinary first
    await deleteJobImages(job.lorryPhotos);

    await JobPost.findByIdAndDelete(jobId);
    
    await Like.deleteMany({
      likedItemId: jobId,
      likedType: 'job'
    });

    res.status(200).json({ message: 'Job deleted successfully' });
    
  } catch (err) {
    console.error('Error in deleteJob:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update uploadImages function for job photos
const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    
    const urls = req.files.map(file => file.path);
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

// Update updateJob function to handle image uploads
const updateJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await JobPost.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.ownerId !== req.userId) {
      return res.status(403).json({ error: 'You are not authorized to update this job' });
    }

    // Handle new image uploads
    let newPhotoUrls = [];
    if (req.files && req.files.length > 0) {
      newPhotoUrls = req.files.map(file => file.path);
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

    res.status(200).json(updatedJob);
  } catch (err) {
    console.error('Error in updateJob:', err);
    res.status(500).json({ error: err.message });
  }
};

// Keep all existing functions and add the new ones
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

    res.status(200).json(jobs);
  } catch (err) {
    console.error('Error in getJobs:', err);
    res.status(500).json({ error: err.message });
  }
};

const getJobsByOwner = async (req, res) => {
  try {
    const jobs = await JobPost.find({ ownerId: req.userId });
    res.status(200).json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
    
    res.status(200).json(jobs);
  } catch (err) {
    console.error('Error in getJobsForDriver:', err);
    res.status(500).json({ 
      error: 'Failed to fetch jobs',
      details: err.message 
    });
  }
};

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
    });
  } catch (err) {
    console.error('Error in getFilterOptions:', err);
    res.status(500).json({ error: err.message });
  }
};

const getJobsByOwnerId = async (req, res) => {
  try {
    const jobs = await JobPost.find({ ownerId: req.params.ownerId });
    res.status(200).json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getJobDetails = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.jobId)) {
      return res.status(400).json({ error: "Invalid job ID format" });
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
      return res.status(404).json({ error: "Job not found" });
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
      ...job,
      likeCount,
      isLiked
    });
  } catch (err) {
    console.error("Error fetching job details:", err);
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};

const uploadJobPhotos = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await JobPost.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const newPhotos = req.files.map(file => file.path);
    job.lorryPhotos = [...(job.lorryPhotos || []), ...newPhotos];
    await job.save();
    res.status(200).json({ message: 'Photos uploaded', lorryPhotos: job.lorryPhotos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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