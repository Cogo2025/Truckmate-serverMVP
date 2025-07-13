const DriverProfile = require('../models/DriverProfile');
const OwnerProfile = require('../models/OwnerProfile');
const JobPost = require('../models/JobPost');
const path = require('path');
const fs = require('fs');



// ✅ Helper function to generate proper photo URLs
const generatePhotoUrl = (filename) => {
  const baseUrl = process.env.BASE_URL || 'http://192.168.29.138:5000'; // Use your IP
  return `${baseUrl}/uploads/${filename}`;
};



const createOwnerProfile = async (req, res) => {
  try {
    console.log('📤 Creating owner profile...');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    console.log('User ID:', req.userId);

    // Check if profile already exists
    const existingProfile = await OwnerProfile.findOne({ userId: req.userId });
    if (existingProfile) {
      return res.status(400).json({ error: "Profile already exists" });
    }

    // Validate required fields
    const { companyName, companyLocation, gender } = req.body;
    
    if (!companyName || !companyLocation || !gender) {
      return res.status(400).json({ 
        error: "Missing required fields", 
        required: ["companyName", "companyLocation", "gender"] 
      });
    }

    // Handle photo upload
    let photoUrl = '';
    if (req.file) {
      photoUrl = generatePhotoUrl(req.file.filename);
      console.log('📸 Photo uploaded:', photoUrl);
    }

    // Create profile
    const profileData = {
      userId: req.userId,
      companyName: companyName.trim(),
      companyLocation: companyLocation.trim(),
      gender: gender.trim(),
      photoUrl,
      companyInfoCompleted: true
    };

    const profile = await OwnerProfile.create(profileData);
    
    console.log('✅ Profile created successfully:', profile._id);
    
    res.status(201).json({
      success: true,
      message: "Profile created successfully",
      profile: profile
    });
  } catch (err) {
    console.error('❌ Error creating owner profile:', err);
    
    // Clean up uploaded file if profile creation fails
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      error: "Failed to create profile", 
      details: err.message 
    });
  }
};
// ✅ Get owner profile
const getOwnerProfile = async (req, res) => {
  try {
    console.log('📥 Fetching owner profile for user:', req.userId);
    
    const profile = await OwnerProfile.findOne({ userId: req.userId });
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    console.log('✅ Profile found:', profile._id);
    res.status(200).json(profile);
  } catch (err) {
    console.error('❌ Error fetching owner profile:', err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// ✅ Update owner profile
const updateOwnerProfile = async (req, res) => {
  try {
    console.log('📝 Updating owner profile for user:', req.userId);
    
    const { companyName, companyLocation, gender } = req.body;
    
    const updateData = {};
    if (companyName) updateData.companyName = companyName.trim();
    if (companyLocation) updateData.companyLocation = companyLocation.trim();
    if (gender) updateData.gender = gender.trim();
    
    // Handle photo upload if provided
    if (req.file) {
      // Get old profile to delete old photo
      const oldProfile = await OwnerProfile.findOne({ userId: req.userId });
      if (oldProfile && oldProfile.photoUrl) {
        const oldPhotoPath = path.join(__dirname, '../uploads', path.basename(oldProfile.photoUrl));
        try {
          if (fs.existsSync(oldPhotoPath)) {
            fs.unlinkSync(oldPhotoPath);
            console.log('🗑️ Old photo deleted:', oldPhotoPath);
          }
        } catch (deleteError) {
          console.error('Error deleting old photo:', deleteError);
        }
      }
      
      updateData.photoUrl = generatePhotoUrl(req.file.filename);
    }

    const profile = await OwnerProfile.findOneAndUpdate(
      { userId: req.userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    console.log('✅ Profile updated successfully:', profile._id);
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: profile
    });
  } catch (err) {
    console.error('❌ Error updating owner profile:', err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};


// ✅ Get owner profile by ID (for other users to view)
const getOwnerProfileById = async (req, res) => {
  try {
    console.log('📥 Fetching owner profile by ID:', req.params.ownerId);
    
    const profile = await OwnerProfile.findOne({ userId: req.params.ownerId }).lean().exec();
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    console.log('✅ Profile found:', profile._id);
    res.status(200).json(profile);
  } catch (err) {
    console.error('❌ Error fetching owner profile by ID:', err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// ✅ Get jobs posted by owner
const getOwnerJobs = async (req, res) => {
  try {
    console.log('📥 Fetching jobs for owner:', req.params.ownerId);
    
    const jobs = await JobPost.find({ ownerId: req.params.ownerId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    console.log(`✅ Found ${jobs.length} jobs for owner`);
    res.status(200).json(jobs);
  } catch (err) {
    console.error('❌ Error fetching owner jobs:', err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// ✅ Create driver profile
const createDriverProfile = async (req, res) => {
  try {
    console.log('📤 Creating driver profile for user:', req.userId);
    console.log('Request body:', req.body);

    // Check if profile already exists
    const existingProfile = await DriverProfile.findOne({ userId: req.userId });
    if (existingProfile) {
      return res.status(400).json({ error: "Profile already exists" });
    }

    // Handle photo upload
    let photoUrl = '';
    if (req.file) {
      photoUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/${req.file.filename}`;
      console.log('📸 Photo uploaded:', photoUrl);
    }

    const profileData = {
      ...req.body,
      userId: req.userId,
      photoUrl
    };

    const profile = await DriverProfile.create(profileData);
    
    console.log('✅ Driver profile created successfully:', profile._id);
    res.status(201).json({
      success: true,
      message: "Driver profile created successfully",
      profile: profile
    });
  } catch (err) {
    console.error('❌ Error creating driver profile:', err);
    
    // Clean up uploaded file if profile creation fails
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      error: "Failed to create driver profile", 
      details: err.message 
    });
  }
};

// ✅ Get driver profile
const getDriverProfile = async (req, res) => {
  try {
    console.log('📥 Fetching driver profile for user:', req.userId);
    
    const profile = await DriverProfile.findOne({ userId: req.userId });
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    console.log('✅ Driver profile found:', profile._id);
    res.status(200).json(profile);
  } catch (err) {
    console.error('❌ Error fetching driver profile:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// ✅ Update driver profile
const updateDriverProfile = async (req, res) => {
  try {
    console.log('📝 Updating driver profile for user:', req.userId);
    
    const updateData = { ...req.body };
    
    // Handle photo upload if provided
    if (req.file) {
      // Get old profile to delete old photo
      const oldProfile = await DriverProfile.findOne({ userId: req.userId });
      if (oldProfile && oldProfile.photoUrl) {
        const oldPhotoPath = path.join(__dirname, '../uploads', path.basename(oldProfile.photoUrl));
        try {
          if (fs.existsSync(oldPhotoPath)) {
            fs.unlinkSync(oldPhotoPath);
            console.log('🗑️ Old photo deleted:', oldPhotoPath);
          }
        } catch (deleteError) {
          console.error('Error deleting old photo:', deleteError);
        }
      }
      
      updateData.photoUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/${req.file.filename}`;
    }

    const profile = await DriverProfile.findOneAndUpdate(
      { userId: req.userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    console.log('✅ Driver profile updated successfully:', profile._id);
    res.status(200).json({
      success: true,
      message: "Driver profile updated successfully",
      profile: profile
    });
  } catch (err) {
    console.error('❌ Error updating driver profile:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// ✅ Delete profile photo
const deleteProfilePhoto = async (req, res) => {
  try {
    const { userType } = req.body; // 'owner' or 'driver'
    
    let ProfileModel;
    if (userType === 'owner') {
      ProfileModel = OwnerProfile;
    } else if (userType === 'driver') {
      ProfileModel = DriverProfile;
    } else {
      return res.status(400).json({ error: "Invalid user type" });
    }

    const profile = await ProfileModel.findOne({ userId: req.userId });
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    if (profile.photoUrl) {
      const photoPath = path.join(__dirname, '../uploads', path.basename(profile.photoUrl));
      try {
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
          console.log('🗑️ Photo deleted:', photoPath);
        }
      } catch (deleteError) {
        console.error('Error deleting photo:', deleteError);
      }
    }

    // Remove photoUrl from profile
    profile.photoUrl = '';
    await profile.save();

    res.status(200).json({
      success: true,
      message: "Profile photo deleted successfully"
    });
  } catch (err) {
    console.error('❌ Error deleting profile photo:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const testImageAccess = async (req, res) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(__dirname, '../uploads', filename);
    
    if (fs.existsSync(imagePath)) {
      res.json({
        success: true,
        message: "Image found",
        url: generatePhotoUrl(filename),
        path: imagePath
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Image not found",
        path: imagePath
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};





module.exports = {
  createDriverProfile,
  createOwnerProfile,
  getOwnerProfile,
  getDriverProfile,
  updateDriverProfile,
  updateOwnerProfile,
  getOwnerProfileById,
  getOwnerJobs,
  deleteProfilePhoto,
   testImageAccess,
};