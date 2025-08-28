const DriverProfile = require('../models/DriverProfile');
const OwnerProfile = require('../models/OwnerProfile');
const JobPost = require('../models/JobPost');
const User = require('../models/User');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const VerificationRequest = require('../models/VerificationRequest');


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

// Add this helper function at the top after other helpers
const autoCreateVerificationRequest = async (userId, profileId) => {
  try {
    // Check if verification request already exists
    const existingRequest = await VerificationRequest.findOne({
      driverId: userId,
      status: 'pending'
    });

    if (existingRequest) {
      console.log("⚠️ Verification request already exists for:", userId);
      return;
    }

    const driverProfile = await DriverProfile.findById(profileId);
    if (!driverProfile) {
      console.log("⚠️ Driver profile not found for verification");
      return;
    }

    // Create verification request automatically
    const verificationRequest = await VerificationRequest.create({
      driverId: userId,
      profileId: profileId,
      documents: {
        licensePhotoFront: driverProfile.licensePhotoFront,
        licensePhotoBack: driverProfile.licensePhotoBack,
        profilePhoto: driverProfile.profilePhoto
      }
    });

    console.log("✅ Auto-created verification request:", verificationRequest._id);
    return verificationRequest;
  } catch (error) {
    console.error("❌ Error auto-creating verification request:", error);
  }
};

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
});

// Multer configurations (Driver: Profile + License [front/back])
// Multer configurations with custom storage per field
const uploadDriverFiles = multer({
  storage: driverLicenseStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
}).fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'licensePhotoFront', maxCount: 1 },
  { name: 'licensePhotoBack', maxCount: 1 }
]);



const uploadOwnerProfile = multer({
  storage: ownerProfileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Helper to delete images from Cloudinary
const deleteCloudinaryImage = async (imageUrl) => {
  try {
    if (!imageUrl) return;
    const urlParts = imageUrl.split('/');
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = publicIdWithExtension.split('.')[0];
    const folder = urlParts[urlParts.length - 2];
    const fullPublicId = `${folder}/${publicId}`;
    await cloudinary.uploader.destroy(fullPublicId);
  } catch (error) {
    throw error;
  }
};

// --- DRIVER PROFILE FUNCTIONS ---

// Create driver profile (supports dual license photos)
const createDriverProfile = async (req, res) => {
  try {
    console.log("📌 [CREATE] Incoming Driver Profile Request");
    console.log("🔑 Authenticated UID:", req.userId);
    console.log("📩 Body:", req.body);
    console.log("📂 Files:", req.files);

    const {name, experience, gender, knownTruckTypes, licenseNumber, licenseExpiryDate, age, location } = req.body;

    // File paths
    let profilePhotoUrl = req.files?.profilePhoto ? req.files.profilePhoto[0].path : '';
    let licensePhotoFrontUrl = req.files?.licensePhotoFront ? req.files.licensePhotoFront[0].path : '';
    let licensePhotoBackUrl = req.files?.licensePhotoBack ? req.files.licensePhotoBack[0].path : '';

    // Parse truck types if JSON or CSV
    let parsedTruckTypes = knownTruckTypes;
    if (typeof knownTruckTypes === 'string') {
      try {
        parsedTruckTypes = JSON.parse(knownTruckTypes);
      } catch (e) {
        parsedTruckTypes = knownTruckTypes.split(',');
      }
    }

    // Check if profile already exists → Update instead of creating duplicate
    let profile = await DriverProfile.findOne({ userId: req.userId });
    if (profile) {
      console.log("🔄 Updating existing driver profile");
      profile.set({
        name,
        profilePhoto: profilePhotoUrl,
        licensePhotoFront: licensePhotoFrontUrl,
        licensePhotoBack: licensePhotoBackUrl,
        licenseNumber,
        licenseExpiryDate,
        knownTruckTypes: parsedTruckTypes,
        experience,
        gender,
        age,
        location,
        profileCompleted: true,
        verificationStatus: 'pending'  // Set to pending for verification
      });
      await profile.save();
    } else {
      console.log("🆕 Creating new driver profile");
      profile = await DriverProfile.create({
        userId: req.userId,
        name,
        profilePhoto: profilePhotoUrl,
        licensePhotoFront: licensePhotoFrontUrl,
        licensePhotoBack: licensePhotoBackUrl,
        licenseNumber,
        licenseExpiryDate,
        knownTruckTypes: parsedTruckTypes,
        experience,
        gender,
        age,
        location,
        profileCompleted: true,
        verificationStatus: 'pending'  // Set to pending for verification
      });
    }

    // Auto-create verification request
    await autoCreateVerificationRequest(req.userId, profile._id);

    console.log("✅ Driver Profile Saved:", profile);
    res.status(201).json({ success: true, profile });
  } catch (err) {
    console.error("❌ [CREATE DRIVER PROFILE ERROR]:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create profile",
      error: err.message
    });
  }
};


// Update driver profile (dual photo support, old image removal)
const updateDriverProfile = async (req, res) => {
  try {
    const updateData = { ...req.body };
    const currentProfile = await DriverProfile.findOne({ userId: req.userId });
    // New photos, handle deletion of old
    if (req.files) {
      if (req.files['profilePhoto']) {
        if (currentProfile.profilePhoto) {
          await deleteCloudinaryImage(currentProfile.profilePhoto);
        }
        updateData.profilePhoto = req.files['profilePhoto'][0].path;
      }
      if (req.files['licensePhotoFront']) {
        if (currentProfile.licensePhotoFront) {
          await deleteCloudinaryImage(currentProfile.licensePhotoFront);
        }
        updateData.licensePhotoFront = req.files['licensePhotoFront'][0].path;
      }
      if (req.files['licensePhotoBack']) {
        if (currentProfile.licensePhotoBack) {
          await deleteCloudinaryImage(currentProfile.licensePhotoBack);
        }
        updateData.licensePhotoBack = req.files['licensePhotoBack'][0].path;
      }
    }
    // Parse truck types if necessary
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

// --- OWNER PROFILE FUNCTIONS (unchanged) ---

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
    const currentProfile = await OwnerProfile.findOne({ userId: req.userId });
    if (req.file) {
      if (currentProfile && currentProfile.photoUrl) {
        await deleteCloudinaryImage(currentProfile.photoUrl);
      }
      updateData.photoUrl = req.file.path;
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
      profile: profile
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// --- EXISTING FUNCTIONS (unchanged) ---

const getDriverProfile = async (req, res) => {
  try {
    console.log("📌 [FETCH] Driver Profile Request");
    console.log("🔑 Authenticated UID:", req.userId);
    
    // Get both user and profile data
    const user = await User.findOne({ googleId: req.userId });
    const profile = await DriverProfile.findOne({ userId: req.userId });
    
    if (!profile) {
      console.log("⚠️ No driver profile found for:", req.userId);
      return res.status(404).json({
        success: false,
        message: "Profile not found. Please complete your profile setup."
      });
    }
    
    // Combine user and profile data
    const profileWithUserData = {
      ...profile.toObject(),
      // Add user data to profile
      userName: user?.name || 'Unknown',
      userPhone: user?.phone || 'Not provided',
      userEmail: user?.email || 'Not provided',
      userPhotoUrl: user?.photoUrl || '',
      isAvailable: user?.isAvailable || false
    };
    
    console.log("✅ Profile found with user data:", profileWithUserData);
    res.status(200).json({ success: true, profile: profileWithUserData });
  } catch (err) {
    console.error("❌ [FETCH DRIVER PROFILE ERROR]:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: err.message
    });
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
// Add this function to your profileController.js
const updateUserInfo = async (req, res) => {
  try {
    const { name, phone } = req.body;
    
    // Validate input
    if (!name || !phone) {
      return res.status(400).json({ 
        error: "Name and phone are required" 
      });
    }

    // Update user information
    const updatedUser = await User.findOneAndUpdate(
      { googleId: req.userId },
      { 
        name: name.trim(),
        phone: phone.trim()
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ 
        error: "User not found" 
      });
    }

    res.status(200).json({
      success: true,
      message: "User information updated successfully",
      user: {
        name: updatedUser.name,
        phone: updatedUser.phone,
        email: updatedUser.email
      }
    });

  } catch (err) {
    console.error("❌ [UPDATE USER INFO ERROR]:", err);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
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
    const jobs = await JobPost.find({ ownerId: req.params.ownerId }).sort({ createdAt: -1 }).lean().exec();
    res.status(200).json(jobs);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// --- PHOTO/UTILITY FUNCTIONS ---

const deleteProfilePhoto = async (req, res) => {
  try {
    const { userType, photoType } = req.body;
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
      if (photoType === 'licenseFront') {
        photoUrl = profile.licensePhotoFront;
        updateField = 'licensePhotoFront';
      } else if (photoType === 'licenseBack') {
        photoUrl = profile.licensePhotoBack;
        updateField = 'licensePhotoBack';
      } else if (photoType === 'profile') {
        photoUrl = profile.profilePhoto;
        updateField = 'profilePhoto';
      } else {
        return res.status(400).json({ error: "Invalid photo type for driver" });
      }
    } else { // owner
      photoUrl = profile.photoUrl;
      updateField = 'photoUrl';
    }
    // Optionally: Delete from Cloudinary
    if (photoUrl) await deleteCloudinaryImage(photoUrl);
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

// Check completion
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

// Availability
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

// Get available drivers
const getAvailableDrivers = async (req, res) => {
  try {
    const { location, truckType } = req.query;
    const matchConditions = {
      role: 'driver',
      isAvailable: true
    };
    if (location) matchConditions['profile.location'] = new RegExp(location, 'i');
    let truckTypeFilter = {};
    if (truckType) truckTypeFilter = {
      'profile.knownTruckTypes': new RegExp(truckType, 'i')
    };
    const availableDrivers = await User.aggregate([
      { $match: { role: 'driver', isAvailable: true } },
      { $lookup: {
          from: 'driverprofiles',
          localField: 'googleId',
          foreignField: 'userId',
          as: 'profile'
        }
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      { $match: { ...matchConditions, ...truckTypeFilter } },
      { $project: {
          _id: 0,
          id: '$googleId',
          name: 1,
          phone: 1,
          email: 1,
          photoUrl: '$profile.profilePhoto',
          experience: '$profile.experience',
          location: '$profile.location',
          licenseNumber: '$profile.licenseNumber',
          truckTypes: '$profile.knownTruckTypes',
          licensePhotoFront: '$profile.licensePhotoFront', // NEW
          licensePhotoBack: '$profile.licensePhotoBack'    // NEW
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
  checkProfileCompletion,
  updateAvailability,
  getAvailableDrivers,
  uploadOwnerProfile,
  uploadDriverFiles,
  updateUserInfo  
};
