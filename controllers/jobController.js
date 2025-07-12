const JobPost = require('../models/JobPost');
const DriverProfile = require('../models/DriverProfile');
const Like = require('../models/Like');

// Define all controller functions first
const createJob = async (req, res) => {
  try {
    const job = await JobPost.create({ ...req.body, ownerId: req.userId });
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getJobs = async (req, res) => {
  try {
    const jobs = await JobPost.find();
    res.status(200).json(jobs);
  } catch (err) {
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
    const driverProfile = await DriverProfile.findOne({ userId: req.userId });
    const filters = {};
    
    if (req.query.truckType) {
      filters.truckType = req.query.truckType;
    } else if (driverProfile?.knownTruckTypes?.length > 0) {
      filters.truckType = { $in: driverProfile.knownTruckTypes };
    }
    
    if (req.query.location) {
      filters.sourceLocation = { $regex: req.query.location, $options: 'i' };
    }
    
    if (req.query.minSalary || req.query.maxSalary) {
      filters['salaryRange.min'] = {};
      filters['salaryRange.max'] = {};
      
      if (req.query.minSalary) {
        filters['salaryRange.min'] = { $gte: parseInt(req.query.minSalary) };
      }
      
      if (req.query.maxSalary) {
        filters['salaryRange.max'] = { $lte: parseInt(req.query.maxSalary) };
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
    
    console.log('Applied filters:', filters);
    
    const jobs = await JobPost.find(filters)
      .sort({ createdAt: -1 })
      .limit(req.query.limit ? parseInt(req.query.limit) : 100);
    
    res.status(200).json(jobs);
  } catch (err) {
    console.error('Error in getJobsForDriver:', err);
    res.status(500).json({ error: err.message });
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
      JobPost.distinct('truckType'),
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
    
    res.status(200).json({
      truckTypes: truckTypes.filter(Boolean),
      locations: locations.filter(Boolean),
      salaryRange: { min: minSalary, max: maxSalary },
      variantTypes: variantTypes.filter(Boolean),
      wheelsOrFeetOptions: wheelsOrFeetOptions.filter(Boolean),
      experienceOptions: experienceOptions.filter(Boolean),
      dutyTypes: dutyTypes.filter(Boolean),
      salaryTypes: salaryTypes.filter(Boolean)
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
    const job = await JobPost.findById(req.params.jobId)
      .lean()
      .exec();

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

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

// Export all functions at the end
module.exports = {
  createJob,
  getJobs,
  getJobsByOwner,
  getJobsForDriver,
  getFilterOptions,
  getJobsByOwnerId,
  getJobDetails
};