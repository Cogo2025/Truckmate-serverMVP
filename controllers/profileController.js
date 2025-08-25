const DriverProfile = require('../models/DriverProfile');
const OwnerProfile = require('../models/OwnerProfile');
const JobPost = require('../models/JobPost');
const User = require('../models/User');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');

// Cloudinary storage configurations
const driverProfileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'truckmate/drivers/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [
      { width: 800, height: 800, crop: 'limit' },
      { quality: 'auto' }
    ],
  },
});

const driverLicenseStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'truckmate/drivers/licenses',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [
      { width: 1200, height: 800, crop: 'limit' },
      { quality: 'auto' }
    ],
  },
});

const ownerProfileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'truckmate/owners/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [
      { width: 800, height: 800, crop: 'limit' },
      { quality: 'auto' }
    ],
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'owner-profile-' + uniqueSuffix);
  }
});

// Multer configurations
const uploadDriverProfile = multer({ 
  storage: driverProfileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const uploadDriverLicense = multer({ 
  storage: driverLicenseStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const uploadOwnerProfile = multer({ 
  storage: ownerProfileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Combined multer for driver (profile + license)
const uploadDriverFiles = multer({ storage: driverProfileStorage }).fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'licensePhoto', maxCount: 1 }
]);

// Helper function to delete image from Cloudinary
const deleteCloudinaryImage = async (imageUrl) => {
  try {
    if (!imageUrl) return;
    
    // Extract public_id from Cloudinary URL
    const urlParts = imageUrl.split('/');
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = publicIdWithExtension.split('.')[0];
    
    // Get the folder name (second to last part of URL)
    const folder = urlParts[urlParts.length - 2];
    
    const fullPublicId = `${folder}/${publicId}`;
    
    console.log('Deleting Cloudinary image:', fullPublicId);
    
    const result = await cloudinary.uploader.destroy(fullPublicId);
    console.log('Cloudinary delete result:', result);
    
    return result;
  } catch (error) {
    console.error('Error deleting Cloudinary image:', error);
    throw error;
  }
};

// --- DRIVER PROFILE FUNCTIONS ---
const createDriverProfile = async (req, res) => {
  try {
    const { experience, gender, knownTruckTypes, licenseNumber, licenseExpiryDate, age, location } = req.body;
    
    let profilePhotoUrl = '';
    let licensePhotoUrl = '';
    
    // Handle file uploads
    if (req.files) {
      if (req.files['profilePhoto']) {
        profilePhotoUrl = req.files['profilePhoto'][0].path;
      }
      if (req.files['licensePhoto']) {
        licensePhotoUrl = req.files['licensePhoto'].path;
      }
    }

    // Parse truck types if it's a string
    let parsedTruckTypes = knownTruckTypes;
    if (typeof knownTruckTypes === 'string') {
      try {
        parsedTruckTypes = JSON.parse(knownTruckTypes);
      } catch (e) {
        parsedTruckTypes = [knownTruckTypes];
      }
    }

    const profile = await DriverProfile.create({
      userId: req.userId,
      profilePhoto: profilePhotoUrl,
      licensePhoto: licensePhotoUrl,
      licenseNumber,
      licenseExpiryDate,
      knownTruckTypes: parsedTruckTypes,
      experience,
      gender,
      age,
      location,
      profileCompleted: true
    });

    res.status(201).json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateDriverProfile = async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Get current profile to access old image URLs
    const currentProfile = await DriverProfile.findOne({ userId: req.userId });
    
    // Handle file uploads and delete old images
    if (req.files) {
      if (req.files['profilePhoto']) {
        if (currentProfile.profilePhoto) {
          await deleteCloudinaryImage(currentProfile.profilePhoto);
        }
        updateData.profilePhoto = req.files['profilePhoto'][0].path;
      }
      if (req.files['licensePhoto']) {
        if (currentProfile.licensePhoto) {
          await deleteCloudinaryImage(currentProfile.licensePhoto);
        }
        updateData.licensePhoto = req.files['licensePhoto'].path;
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

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.status(200).json({
      success: true,
      message: "Driver profile updated successfully",
      profile: profile
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// --- OWNER PROFILE FUNCTIONS ---
const createOwnerProfile = async (req, res) => {
  try {
    const { companyName, companyLocation, gender } = req.body;
    const photoUrl = req.file ? req.file.path : '';

    const profile = await OwnerProfile.create({
      userId: req.userId,
      companyName,
      companyLocation,
      gender,
      photoUrl,
      companyInfoCompleted: true
    });

    res.status(201).json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateOwnerProfile = async (req, res) => {
  try {
    const { companyName, companyLocation, gender } = req.body;
    const updateData = {};

    if (companyName) updateData.companyName = companyName.trim();
    if (companyLocation) updateData.companyLocation = companyLocation.trim();
    if (gender) updateData.gender = gender.trim();

    // Get current profile to access old image URL
    const currentProfile = await OwnerProfile.findOne({ userId: req.userId });

    // Handle file upload and delete old image
    if (req.file) {
      console.log('File uploaded:', req.file); // Debug log
      
      if (currentProfile && currentProfile.photoUrl) {
        await deleteCloudinaryImage(currentProfile.photoUrl);
      }
      
      // Use the secure_url from Cloudinary response
      updateData.photoUrl = req.file.path; // This should be the Cloudinary URL
    }

    const profile = await OwnerProfile.findOneAndUpdate(
      { userId: req.userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: profile // Return the updated profile
    });
  } catch (err) {
    console.error('Update owner profile error:', err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// --- EXISTING FUNCTIONS (keep these as they are) ---
const getDriverProfile = async (req, res) => {
  try {
    const profile = await DriverProfile.findOne({ userId: req.userId });
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.status(200).json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const getOwnerProfile = async (req, res) => {
  try {
    const profile = await OwnerProfile.findOne({ userId: req.userId });
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.status(200).json(profile);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
}; 
const getOwnerProfileById = async (req, res) => {
  try {
    const profile = await OwnerProfile.findOne({ userId: req.params.ownerId }).lean().exec();
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.status(200).json(profile);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};


const getOwnerJobs = async (req, res) => {
  try {
    const jobs = await JobPost.find({ ownerId: req.params.ownerId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    res.status(200).json(jobs);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// --- PHOTO/UTILITY FUNCTIONS ---

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

    // Optionally: Delete from Cloudinary here if you want

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

const updateUserInfo = async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const phoneRegex = /^[+]?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    const existingUser = await User.findOne({
      phone: phone.trim(),
      googleId: { $ne: req.userId }
    });

    if (existingUser) {
      return res.status(400).json({ error: "Phone number already in use by another user" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { googleId: req.userId },
      {
        name: name.trim(),
        phone: phone.trim()
      },
      { new: true, runValidators: true }
    ).select('-password');
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({
      success: true,
      message: "User information updated successfully",
      user: updatedUser
    });
  } catch (err) {
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
    res.status(500).json({ error: "Failed to update availability" });
  }
};

const getAvailableDrivers = async (req, res) => {
  try {
    const { location, truckType } = req.query;
    const matchConditions = {
      role: 'driver',
      isAvailable: true
    };
    if (location) {
      matchConditions['profile.location'] = new RegExp(location, 'i');
    }

    let truckTypeFilter = {};
    if (truckType) {
      truckTypeFilter = {
        'profile.knownTruckTypes': new RegExp(truckType, 'i')
      };
    }

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
    res.status(200).json({ drivers: availableDrivers });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
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
  getAvailableDrivers,
  uploadDriverProfile,
  uploadDriverLicense,
  uploadOwnerProfile,
  uploadDriverFiles,
};