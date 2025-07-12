const Like = require('../models/Like');
const JobPost = require('../models/JobPost');

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
    console.log('Fetching liked jobs for user:', req.userId); // Log the user ID
    
    // Get all likes by current user
    const likes = await Like.find({ 
      likedBy: req.userId,
      likedType: 'job'
    }).lean().exec();

    console.log('Found likes:', likes.length); // Log number of likes found
    
    if (!likes || likes.length === 0) {
      console.log('No likes found for user');
      return res.status(200).json([]);
    }

    // Get job details for each liked job
    const jobIds = likes.map(like => like.likedItemId);
    console.log('Job IDs to fetch:', jobIds);

    const jobs = await JobPost.find({ _id: { $in: jobIds } })
      .populate('ownerId', 'companyName photoUrl')
      .lean()
      .exec();

    console.log('Jobs found:', jobs.length); // Log number of jobs found
    res.status(200).json(jobs);
    
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