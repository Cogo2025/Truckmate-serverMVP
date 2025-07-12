const DriverProfile = require('../models/DriverProfile');
const OwnerProfile = require('../models/OwnerProfile');
const JobPost = require('../models/JobPost');

// Create driver profile
const createDriverProfile = async (req, res) => {
  try {
    const profile = await DriverProfile.create({ ...req.body, userId: req.userId });
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create owner profile
const createOwnerProfile = async (req, res) => {
  try {
    const profile = await OwnerProfile.create({ 
      ...req.body, 
      userId: req.userId,
      companyInfoCompleted: true 
    });
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get owner profile
const getOwnerProfile = async (req, res) => {
  try {
    const profile = await OwnerProfile.findOne({ userId: req.userId });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.status(200).json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get driver profile
const getDriverProfile = async (req, res) => {
  try {
    const profile = await DriverProfile.findOne({ userId: req.userId });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.status(200).json(profile);
  } catch (err) {
    console.error("Error fetching driver profile:", err);
    res.status(500).json({ 
      error: 'Server error',
      details: err.message 
    });
  }
};

// Update driver profile
const updateDriverProfile = async (req, res) => {
  try {
    const profile = await DriverProfile.findOneAndUpdate(
      { userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.status(200).json(profile);
  } catch (err) {
    console.error("Error updating driver profile:", err);
    res.status(500).json({ 
      error: 'Server error',
      details: err.message 
    });
  }
};

// Get owner profile by ID
const getOwnerProfileById = async (req, res) => {
  try {
    const profile = await OwnerProfile.findOne({ userId: req.params.ownerId })
      .lean()
      .exec();

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.status(200).json(profile);
  } catch (err) {
    console.error("Error fetching owner profile:", err);
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};

// Get jobs by owner ID
const getOwnerJobs = async (req, res) => {
  try {
    const jobs = await JobPost.find({ ownerId: req.params.ownerId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    res.status(200).json(jobs);
  } catch (err) {
    console.error("Error fetching owner jobs:", err);
    res.status(500).json({ 
      error: "Server error",
      details: err.message 
    });
  }
};

module.exports = {
  createDriverProfile,
  createOwnerProfile,
  getOwnerProfile,
  getDriverProfile,
  updateDriverProfile,
  getOwnerProfileById,
  getOwnerJobs
};