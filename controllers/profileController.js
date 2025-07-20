const DriverProfile = require('../models/DriverProfile');
const OwnerProfile = require('../models/OwnerProfile');
const JobPost = require('../models/JobPost');
const User = require('../models/User'); // Add this import for user updates
const path = require('path');
const fs = require('fs');

// ✅ Helper function to generate proper photo URLs
const generatePhotoUrl = (filename) => {
  const baseUrl = process.env.BASE_URL || 'http://192.168.29.138:5000'; // Use your IP
  return `${baseUrl}/uploads/${filename}`;
};

// ✅ NEW: Update user basic info (name, phone)
const updateUserInfo = async (req, res) => {
  try {
    console.log('📝 Updating user info for user:', req.userId);
    console.log('Request body:', req.body);
    
    const { name, phone } = req.body;
    
    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({ 
        error: "Name and phone are required" 
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[+]?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({ 
        error: "Invalid phone number format" 
      });
    }

    // Check if phone number already exists for another user
    // Use googleId instead of _id since req.userId contains the googleId
    const existingUser = await User.findOne({ 
      phone: phone.trim(), 
      googleId: { $ne: req.userId } // Changed from _id to googleId
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: "Phone number already in use by another user" 
      });
    }

    // Update user info - use googleId instead of _id
    const updatedUser = await User.findOneAndUpdate(
      { googleId: req.userId }, // Changed from _id to googleId
      { 
        name: name.trim(),
        phone: phone.trim()
      },
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-password'); // Exclude password from response

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log('✅ User info updated successfully:', updatedUser.googleId);
    res.status(200).json({
      success: true,
      message: "User information updated successfully",
      user: updatedUser
    });
  } catch (err) {
    console.error('❌ Error updating user info:', err);
    
    // Handle specific validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: errors 
      });
    }
    
    res.status(500).json({ 
      error: "Failed to update user information", 
      details: err.message 
    });
  }
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

// ✅ MODIFIED: Create driver profile with support for both license and profile photos
const createDriverProfile = async (req, res) => {
  try {
    console.log('📤 Creating driver profile for user:', req.userId);
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);

    // Check if profile already exists
    const existingProfile = await DriverProfile.findOne({ userId: req.userId });
    if (existingProfile) {
      return res.status(400).json({ error: "Profile already exists" });
    }

    // Validate required fields
    const { experience, licenseType, gender, knownTruckTypes, licenseNumber, licenseExpiryDate, age, location } = req.body;
    
    if (!experience || !licenseType || !gender || !knownTruckTypes || !licenseNumber || !licenseExpiryDate || !age || !location) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["experience", "licenseType", "gender", "knownTruckTypes", "licenseNumber", "licenseExpiryDate", "age", "location"]
      });
    }

    // Handle photo uploads
    let licensePhotoUrl = '';
    let profilePhotoUrl = '';
    
    // Process files based on fieldname
    if (req.files) {
      if (req.files.licensePhoto) {
        licensePhotoUrl = generatePhotoUrl(req.files.licensePhoto[0].filename);
        console.log('📸 License photo uploaded:', licensePhotoUrl);
      }
      
      if (req.files.profilePhoto) {
        profilePhotoUrl = generatePhotoUrl(req.files.profilePhoto[0].filename);
        console.log('📸 Profile photo uploaded:', profilePhotoUrl);
      }
    }

    // Parse known truck types if it's a string
    let parsedTruckTypes = knownTruckTypes;
    if (typeof knownTruckTypes === 'string') {
      try {
        parsedTruckTypes = JSON.parse(knownTruckTypes);
      } catch (e) {
        parsedTruckTypes = [knownTruckTypes];
      }
    }

    const profileData = {
      userId: req.userId,
      licensePhoto: licensePhotoUrl,
      profilePhoto: profilePhotoUrl, // ✅ NEW: Add profile photo URL
      licenseType: licenseType.trim(),
      licenseNumber: licenseNumber.trim(),
      licenseExpiryDate: new Date(licenseExpiryDate),
      knownTruckTypes: Array.isArray(parsedTruckTypes) ? parsedTruckTypes : [parsedTruckTypes],
      experience: experience.trim(),
      gender: gender.trim(),
      age: parseInt(age),
      location: location.trim(),
      profileCompleted: true
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
    
    // Clean up uploaded files if profile creation fails
    if (req.files) {
      Object.values(req.files).forEach(fileArray => {
        fileArray.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkError) {
            console.error('Error cleaning up file:', unlinkError);
          }
        });
      });
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

// ✅ MODIFIED: Update driver profile with support for both license and profile photos
const updateDriverProfile = async (req, res) => {
  try {
    console.log('📝 Updating driver profile for user:', req.userId);
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);
    
    const updateData = { ...req.body };
    
    // Get old profile to potentially delete old photos
    const oldProfile = await DriverProfile.findOne({ userId: req.userId });
    if (!oldProfile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Handle photo uploads if provided
    if (req.files) {
      // Handle license photo update
      if (req.files.licensePhoto) {
        // Delete old license photo if it exists
        if (oldProfile.licensePhoto) {
          const oldLicensePhotoPath = path.join(__dirname, '../uploads', path.basename(oldProfile.licensePhoto));
          try {
            if (fs.existsSync(oldLicensePhotoPath)) {
              fs.unlinkSync(oldLicensePhotoPath);
              console.log('🗑️ Old license photo deleted:', oldLicensePhotoPath);
            }
          } catch (deleteError) {
            console.error('Error deleting old license photo:', deleteError);
          }
        }
        
        updateData.licensePhoto = generatePhotoUrl(req.files.licensePhoto[0].filename);
        console.log('📸 New license photo uploaded:', updateData.licensePhoto);
      }
      
      // Handle profile photo update
      if (req.files.profilePhoto) {
        // Delete old profile photo if it exists
        if (oldProfile.profilePhoto) {
          const oldProfilePhotoPath = path.join(__dirname, '../uploads', path.basename(oldProfile.profilePhoto));
          try {
            if (fs.existsSync(oldProfilePhotoPath)) {
              fs.unlinkSync(oldProfilePhotoPath);
              console.log('🗑️ Old profile photo deleted:', oldProfilePhotoPath);
            }
          } catch (deleteError) {
            console.error('Error deleting old profile photo:', deleteError);
          }
        }
        
        updateData.profilePhoto = generatePhotoUrl(req.files.profilePhoto[0].filename);
        console.log('📸 New profile photo uploaded:', updateData.profilePhoto);
      }
    }

    // Parse known truck types if it's a string
    if (updateData.knownTruckTypes && typeof updateData.knownTruckTypes === 'string') {
      try {
        updateData.knownTruckTypes = JSON.parse(updateData.knownTruckTypes);
      } catch (e) {
        updateData.knownTruckTypes = [updateData.knownTruckTypes];
      }
    }

    const profile = await DriverProfile.findOneAndUpdate(
      { userId: req.userId },
      updateData,
      { new: true, runValidators: true }
    );

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

// ✅ MODIFIED: Delete profile photo with support for both license and profile photos
const deleteProfilePhoto = async (req, res) => {
  try {
    const { userType, photoType } = req.body; // 'owner' or 'driver', 'license' or 'profile'
    
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

    let photoUrl = '';
    let updateField = '';

    if (userType === 'driver') {
      if (photoType === 'license') {
        photoUrl = profile.licensePhoto;
        updateField = 'licensePhoto';
      } else if (photoType === 'profile') {
        photoUrl = profile.profilePhoto;
        updateField = 'profilePhoto';
      } else {
        return res.status(400).json({ error: "Invalid photo type for driver" });
      }
    } else {
      photoUrl = profile.photoUrl;
      updateField = 'photoUrl';
    }

    if (photoUrl) {
      const photoPath = path.join(__dirname, '../uploads', path.basename(photoUrl));
      try {
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
          console.log('🗑️ Photo deleted:', photoPath);
        }
      } catch (deleteError) {
        console.error('Error deleting photo:', deleteError);
      }
    }

    // Remove photo URL from profile
    const updateData = {};
    updateData[updateField] = '';
    
    await ProfileModel.findOneAndUpdate(
      { userId: req.userId },
      updateData,
      { new: true }
    );

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

// ✅ Check if profile is completed
const checkProfileCompletion = async (req, res) => {
  try {
    const profile = await DriverProfile.findOne({ userId: req.userId });
    
    if (!profile) {
      return res.status(200).json({ 
        completed: false,
        message: "Profile not created yet" 
      });
    }
    
    res.status(200).json({ 
      completed: profile.profileCompleted,
      profile: profile
    });
  } catch (err) {
    console.error('❌ Error checking profile completion:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};
const getAvailableDrivers = async (req, res) => {
  try {
    console.log('📥 Fetching available drivers');
    const { location, truckType } = req.query;

    // Build match conditions
    const matchConditions = {
      role: 'driver',
      isAvailable: true
    };

    // Add location filter if provided
    if (location) {
      matchConditions['profile.location'] = new RegExp(location, 'i');
    }

    // Add truck type filter if provided
    let truckTypeFilter = {};
    if (truckType) {
      truckTypeFilter = {
        'profile.knownTruckTypes': new RegExp(truckType, 'i')
      };
    }

    // Find users who are drivers and available
    const availableDrivers = await User.aggregate([
      {
        $match: {
          role: 'driver',
          isAvailable: true
        }
      },
      {
        $lookup: {
          from: 'driverprofiles',
          localField: 'googleId',
          foreignField: 'userId',
          as: 'profile'
        }
      },
      {
        $unwind: {
          path: '$profile',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $match: {
          ...matchConditions,
          ...truckTypeFilter
        }
      },
      {
        $project: {
          _id: 0,
          id: '$googleId',
          name: 1,
          phone: 1,
          email: 1,
          photoUrl: '$profile.profilePhoto',
          experience: '$profile.experience',
          location: '$profile.location',
          licenseNumber: '$profile.licenseNumber',
          truckTypes: '$profile.knownTruckTypes'
        }
      }
    ]);

    console.log(`✅ Found ${availableDrivers.length} available drivers`);
    res.status(200).json({ drivers: availableDrivers });
  } catch (err) {
    console.error('❌ Error fetching available drivers:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};
const updateAvailability = async (req, res) => {
  try {
    const { isAvailable } = req.body;
    
    const updatedUser = await User.findOneAndUpdate(
      { googleId: req.userId },
      { isAvailable },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      success: true,
      isAvailable: updatedUser.isAvailable
    });
  } catch (err) {
    console.error('Error updating availability:', err);
    res.status(500).json({ error: "Failed to update availability" });
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
  updateUserInfo,
  checkProfileCompletion,
  updateAvailability,

  getAvailableDrivers
};