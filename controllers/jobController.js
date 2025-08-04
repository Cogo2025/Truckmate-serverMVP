const JobPost = require('../models/JobPost');
const DriverProfile = require('../models/DriverProfile');
const Like = require('../models/Like');
const User = require('../models/User');
const mongoose = require('mongoose'); // Add this missing import

// Define all controller functions first
const createJob = async (req, res) => {
  try {
    // Ensure lorryPhotos is an array
    const lorryPhotos = Array.isArray(req.body.lorryPhotos) 
      ? req.body.lorryPhotos 
      : req.body.lorryPhotos ? [req.body.lorryPhotos] : [];

    const job = await JobPost.create({ 
      ...req.body, 
      lorryPhotos,
      ownerId: req.userId 
    });
    
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
          owner: 0 // Remove the owner array from final result
        }
      },
      {
        $sort: { createdAt: -1 }
      }
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

    // Only apply filters if query parameters exist
    if (Object.keys(req.query).length > 0) {
      // Apply truck type filter ONLY if explicitly requested
      if (req.query.truckType) {
        filters.truckType = req.query.truckType;
      }
      
      // Location filter - exact match (case insensitive)
      if (req.query.sourceLocation) {
        filters.sourceLocation = { 
          $regex: new RegExp(`^${req.query.sourceLocation}$`, 'i') 
        };
      }
      
      // Salary range filter
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
      
      // Variant type filter
      if (req.query.variantType) {
        filters['variant.type'] = req.query.variantType;
      }
      
      // Wheels/feet filter
      if (req.query.wheelsOrFeet) {
        filters['variant.wheelsOrFeet'] = req.query.wheelsOrFeet;
      }
      
      // Experience filter
      if (req.query.experienceRequired) {
        filters.experienceRequired = req.query.experienceRequired;
      }
      
      // Duty type filter
      if (req.query.dutyType) {
        filters.dutyType = req.query.dutyType;
      }
      
      // Salary type filter
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
          owner: 0 // Remove the owner array from final result
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

// Updated getJobDetails function to include owner information
const getJobDetails = async (req, res) => {
  try {
    // Validate ObjectId format
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
          owner: 0 // Remove the owner array from final result
        }
      }
    ]);

    if (!jobs || jobs.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = jobs[0];

    // Get like count
    const likeCount = await Like.countDocuments({
      likedItemId: job._id.toString(),
      likedType: 'job'
    });

    // Check if current user liked this job
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
const updateJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await JobPost.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Check ownership
    if (job.ownerId !== req.userId) {
      return res.status(403).json({ error: 'You are not authorized to update this job' });
    }
    
    // Update fields (including overwriting lorryPhotos with existing ones)
    Object.assign(job, req.body);
    await job.save();
    
    res.status(200).json(job);
  } catch (err) {
    console.error('Error in updateJob:', err);
    res.status(500).json({ error: err.message });
  }
};

// New: Upload photos to job
const uploadJobPhotos = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await JobPost.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Check ownership
    if (job.ownerId !== req.userId) {
      return res.status(403).json({ error: 'You are not authorized to upload photos to this job' });
    }
    
    // Add new photo URLs (assuming baseUrl is your server URL)
    const newPhotos = req.files.map(file => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`);
    job.lorryPhotos = [...job.lorryPhotos, ...newPhotos];
    await job.save();
    
    res.status(200).json({ message: 'Photos uploaded successfully', lorryPhotos: job.lorryPhotos });
  } catch (err) {
    console.error('Error in uploadJobPhotos:', err);
    res.status(500).json({ error: err.message });
  }
};
const deleteJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: "Invalid job ID format" });
    }

    const job = await JobPost.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check ownership - ensure only the owner can delete
    if (job.ownerId !== req.userId) {
      return res.status(403).json({ error: 'You are not authorized to delete this job' });
    }

    // Delete the job
    await JobPost.findByIdAndDelete(jobId);
    
    // Optional: Also delete related likes
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
// Export all functions (add the new ones)
module.exports = {
  createJob,
  getJobs,
  getJobsByOwner,
  getJobsForDriver,
  getFilterOptions,
  getJobsByOwnerId,
  getJobDetails,
  updateJob, // New
  uploadJobPhotos ,// New
  deleteJob  
};