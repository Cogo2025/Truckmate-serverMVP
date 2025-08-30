const Like = require('../models/Like');
const JobPost = require('../models/JobPost');
const OwnerProfile = require('../models/OwnerProfile');
const DriverProfile = require('../models/DriverProfile');
const User = require('../models/User');
exports.likeItem = async (req, res) => {
  try {
    const { likedItemId } = req.body;
    
    if (!likedItemId) {
      return res.status(400).json({ error: "likedItemId is required" });
    }

    // Check if job exists
    const job = await JobPost.findById(likedItemId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Check if already liked
    const existingLike = await Like.findOne({
      likedBy: req.userId,
      likedItemId,
      likedType: 'job'
    });

    if (existingLike) {
      return res.status(400).json({ error: "Job already liked" });
    }

    // Create new like
    const like = await Like.create({
      likedBy: req.userId,
      likedType: 'job',
      likedItemId
    });

    res.status(201).json(like);
  } catch (err) {
    console.error("Error creating like:", err);
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};

exports.unlikeItem = async (req, res) => {
  try {
    const { likedItemId } = req.params;

    const like = await Like.findOneAndDelete({
      likedBy: req.userId,
      likedItemId,
      likedType: 'job'
    });

    if (!like) {
      return res.status(404).json({ error: "Like not found" });
    }

    res.status(200).json({ message: "Successfully unliked" });
  } catch (err) {
    console.error("Error removing like:", err);
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};

exports.getUserLikes = async (req, res) => {
  try {
    console.log('Fetching liked jobs for user:', req.userId);
    
    // Get all likes by current user
    const likes = await Like.find({ 
      likedBy: req.userId,
      likedType: 'job'
    }).lean().exec();

    console.log('Found likes:', likes.length);
    
    if (!likes || likes.length === 0) {
      console.log('No likes found for user');
      return res.status(200).json([]);
    }

    // Get job details for each liked job
    const jobIds = likes.map(like => like.likedItemId);
    console.log('Job IDs to fetch:', jobIds);

    // First get the jobs
    const jobs = await JobPost.find({ _id: { $in: jobIds } })
      .lean()
      .exec();

    console.log('Jobs found:', jobs.length);

    // Then get owner profiles for each job
    const jobsWithOwnerInfo = await Promise.all(
      jobs.map(async (job) => {
        try {
          // Get owner profile using the ownerId (which is a string Google ID)
          const ownerProfile = await OwnerProfile.findOne({ userId: job.ownerId }).lean().exec();
          
          console.log(`Owner profile for job ${job._id}:`, ownerProfile ? 'Found' : 'Not found');
          
          return {
            ...job,
            owner: ownerProfile ? {
              companyName: ownerProfile.companyName,
              photoBase64: ownerProfile.photoBase64 // ✅ Change photoUrl to photoBase64
            } : {
              companyName: 'Unknown Company',
              photoUrl: null
            }
          };
        } catch (error) {
          console.error('Error fetching owner profile for job:', job._id, error);
          return {
            ...job,
            ownerId: {
              companyName: 'Unknown Company',
              photoUrl: null
            }
          };
        }
      })
    );

    console.log('Jobs with owner info prepared:', jobsWithOwnerInfo.length);
    res.status(200).json(jobsWithOwnerInfo);
    
  } catch (err) {
    console.error("Detailed error fetching user likes:", {
      error: err.message,
      stack: err.stack,
      userId: req.userId
    });
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};

exports.checkUserLike = async (req, res) => {
  try {
    const { likedItemId } = req.query;

    if (!likedItemId) {
      return res.status(400).json({ error: "likedItemId is required" });
    }

    const like = await Like.findOne({
      likedBy: req.userId,
      likedItemId,
      likedType: 'job'
    });

    res.status(200).json({
      isLiked: !!like,
      likeId: like?._id
    });
  } catch (err) {
    console.error("Error checking like:", err);
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};


// Like a driver
exports.likeDriver = async (req, res) => {
  try {
    const { driverId } = req.body;
    
    if (!driverId) {
      return res.status(400).json({ error: "driverId is required" });
    }

    // Check if driver exists
    const driver = await User.findOne({ googleId: driverId, role: 'driver' });
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Check if already liked
    const existingLike = await Like.findOne({
      likedBy: req.userId,
      likedItemId: driverId,
      likedType: 'driver'
    });

    if (existingLike) {
      return res.status(400).json({ error: "Driver already liked" });
    }

    // Create new like
    const like = await Like.create({
      likedBy: req.userId,
      likedType: 'driver',
      likedItemId: driverId
    });

    res.status(201).json(like);
  } catch (err) {
    console.error("Error liking driver:", err);
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};

// Unlike a driver
exports.unlikeDriver = async (req, res) => {
  try {
    const { driverId } = req.params;

    const like = await Like.findOneAndDelete({
      likedBy: req.userId,
      likedItemId: driverId,
      likedType: 'driver'
    });

    if (!like) {
      return res.status(404).json({ error: "Like not found" });
    }

    res.status(200).json({ message: "Successfully unliked" });
  } catch (err) {
    console.error("Error unliking driver:", err);
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};

// Get owner's liked drivers
exports.getOwnerLikedDrivers = async (req, res) => {
  try {
    // Get all driver likes by current user
    const likes = await Like.find({ 
      likedBy: req.userId,
      likedType: 'driver'
    }).sort({ createdAt: -1 }).lean().exec();
    
    if (!likes || likes.length === 0) {
      return res.status(200).json([]);
    }

    // Get driver details for each liked driver
    const driverIds = likes.map(like => like.likedItemId);
    
    // First get the users
    const users = await User.find({ googleId: { $in: driverIds } }).lean().exec();
    
    // Then get driver profiles for each user
    const driversWithProfile = await Promise.all(
      users.map(async (user) => {
        const profile = await DriverProfile.findOne({ userId: user.googleId }).lean().exec();
        
        // Get the correct photo URL - prioritize profile photo from DriverProfile
        let photoUrl = user.photoUrl;
        if (profile && profile.profilePhoto) {
          photoUrl = profile.profilePhoto;
        }
        
        return {
          ...user,
          photoUrl: photoUrl, // Add the correct photo URL
          profile,
          likedDate: likes.find(l => l.likedItemId === user.googleId)?.createdAt
        };
      })
    );

    res.status(200).json(driversWithProfile);
  } catch (err) {
    console.error("Error fetching liked drivers:", err);
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};
// Check if owner has liked a specific driver
exports.checkDriverLike = async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({ error: "driverId is required" });
    }

    const like = await Like.findOne({
      likedBy: req.userId,
      likedItemId: driverId,
      likedType: 'driver'
    });

    res.status(200).json({
      isLiked: !!like,
      likeId: like?._id
    });
  } catch (err) {
    console.error("Error checking driver like:", err);
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};