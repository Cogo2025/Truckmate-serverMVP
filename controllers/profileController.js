const DriverProfile = require('../models/DriverProfile');
const OwnerProfile = require('../models/OwnerProfile');
const JobPost = require('../models/JobPost');
const User = require('../models/User');
const VerificationRequest = require('../models/VerificationRequest');
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
});

// Multer configurations
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
    console.error('Error deleting Cloudinary image:', error);
  }
};

// Helper function to auto-create verification request
const autoCreateVerificationRequest = async (userId, profile) => {
  try {
    console.log('🔍 Checking for existing verification request for:', userId);
    
    // Check if verification request already exists
    const existingRequest = await VerificationRequest.findOne({
      driverId: userId,
      status: 'pending'
    });

    if (existingRequest) {
      console.log("⚠️ Verification request already exists:", existingRequest._id);
      return existingRequest;
    }

    console.log('🆕 Creating new verification request for:', userId);
    
    // Create verification request automatically
    const verificationRequest = await VerificationRequest.create({
      driverId: userId,
      profileId: profile._id,
      documents: {
        licensePhotoFront: profile.licensePhotoFront || '',
        licensePhotoBack: profile.licensePhotoBack || '',
        profilePhoto: profile.profilePhoto || ''
      }
    });

    console.log("✅ Auto-created verification request:", verificationRequest._id);
    return verificationRequest;
  } catch (error) {
    console.error("❌ Error auto-creating verification request:", error);
    throw error;
  }
};

// Create driver profile (supports dual license photos)
const createDriverProfile = async (req, res) => {
  try {
    console.log("📌 [CREATE] Incoming Driver Profile Request");
    console.log("🔑 Authenticated UID:", req.userId);
    console.log("📩 Body:", req.body);
    console.log("📂 Files:", req.files);

    const { name, experience, gender, knownTruckTypes, licenseNumber, licenseExpiryDate, age, location } = req.body;

    // Validate required fields
    if (!name || !licenseNumber || !experience || !location) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, licenseNumber, experience, location"
      });
    }

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
        parsedTruckTypes = knownTruckTypes.split(',').map(type => type.trim());
      }
    }

    // Ensure parsedTruckTypes is an array
    if (!Array.isArray(parsedTruckTypes)) {
      parsedTruckTypes = [];
    }

    let profile;
    let isUpdate = false;

    // Check if profile already exists → Update instead of creating duplicate
    const existingProfile = await DriverProfile.findOne({ userId: req.userId });
    
    if (existingProfile) {
      console.log("🔄 Updating existing driver profile");
      isUpdate = true;
      
      existingProfile.set({
        name: name.trim(),
        profilePhoto: profilePhotoUrl,
        licensePhotoFront: licensePhotoFrontUrl,
        licensePhotoBack: licensePhotoBackUrl,
        licenseNumber: licenseNumber.trim(),
        licenseExpiryDate,
        knownTruckTypes: parsedTruckTypes,
        experience: experience.trim(),
        gender: gender?.trim(),
        age: parseInt(age) || 0,
        location: location.trim(),
        profileCompleted: true,
        verificationStatus: 'pending',
        verificationRequestedAt: new Date()
      });
      
      profile = await existingProfile.save();
    } else {
      console.log("🆕 Creating new driver profile");
      
      profile = await DriverProfile.create({
        userId: req.userId,
        name: name.trim(),
        profilePhoto: profilePhotoUrl,
        licensePhotoFront: licensePhotoFrontUrl,
        licensePhotoBack: licensePhotoBackUrl,
        licenseNumber: licenseNumber.trim(),
        licenseExpiryDate,
        knownTruckTypes: parsedTruckTypes,
        experience: experience.trim(),
        gender: gender?.trim(),
        age: parseInt(age) || 0,
        location: location.trim(),
        profileCompleted: true,
        verificationStatus: 'pending',
        verificationRequestedAt: new Date()
      });
    }

    console.log("✅ Driver Profile Saved:", profile._id);

    // Auto-create verification request
    try {
      const verificationRequest = await autoCreateVerificationRequest(req.userId, profile);
      console.log("✅ Verification request handled:", verificationRequest?._id);
    } catch (verificationError) {
      console.error("⚠️ Verification request creation failed:", verificationError);
      // Don't fail the profile creation if verification request fails
    }

    res.status(201).json({ 
      success: true, 
      profile: {
        ...profile.toObject(),
        _id: profile._id,
        userId: profile.userId,
        profileCompleted: profile.profileCompleted,
        verificationStatus: profile.verificationStatus
      },
      message: isUpdate ? 
        "Driver profile updated and submitted for verification" : 
        "Driver profile created and submitted for verification"
    });

  } catch (err) {
    console.error("❌ [CREATE DRIVER PROFILE ERROR]:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create profile",
      error: err.message
    });
  }
};

// Update driver profile (FIXED: Only re-verify for specific fields)
const updateDriverProfile = async (req, res) => {
  try {
    console.log("📌 [UPDATE] Driver Profile Request");
    console.log("🔑 Authenticated UID:", req.userId);
    console.log("📩 Body:", req.body);
    console.log("📂 Files:", req.files);

    const updateData = { ...req.body };
    const currentProfile = await DriverProfile.findOne({ userId: req.userId });

    if (!currentProfile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Track which fields are being updated
    let fieldsBeingUpdated = [];
    
    // Handle new photos and delete old ones
    if (req.files) {
      if (req.files['profilePhoto']) {
        if (currentProfile.profilePhoto) {
          await deleteCloudinaryImage(currentProfile.profilePhoto);
        }
        updateData.profilePhoto = req.files['profilePhoto'][0].path;
        fieldsBeingUpdated.push('profilePhoto');
      }

      if (req.files['licensePhotoFront']) {
        if (currentProfile.licensePhotoFront) {
          await deleteCloudinaryImage(currentProfile.licensePhotoFront);
        }
        updateData.licensePhotoFront = req.files['licensePhotoFront'][0].path;
        fieldsBeingUpdated.push('licensePhotoFront');
      }

      if (req.files['licensePhotoBack']) {
        if (currentProfile.licensePhotoBack) {
          await deleteCloudinaryImage(currentProfile.licensePhotoBack);
        }
        updateData.licensePhotoBack = req.files['licensePhotoBack'][0].path;
        fieldsBeingUpdated.push('licensePhotoBack');
      }
    }

    // Check if name is being updated
    if (updateData.name && updateData.name !== currentProfile.name) {
      fieldsBeingUpdated.push('name');
    }

    // Parse truck types if necessary
    if (updateData.knownTruckTypes && typeof updateData.knownTruckTypes === 'string') {
      try {
        updateData.knownTruckTypes = JSON.parse(updateData.knownTruckTypes);
      } catch (e) {
        updateData.knownTruckTypes = updateData.knownTruckTypes.split(',').map(type => type.trim());
      }
    }

    // Check if truck types are being updated
    if (updateData.knownTruckTypes && 
        JSON.stringify(updateData.knownTruckTypes.sort()) !== JSON.stringify((currentProfile.knownTruckTypes || []).sort())) {
      fieldsBeingUpdated.push('knownTruckTypes');
    }

    console.log("📝 Fields being updated:", fieldsBeingUpdated);

    // *** CRITICAL CHANGE: Only these fields require re-verification ***
    const verificationRequiredFields = ['name', 'knownTruckTypes', 'licensePhotoFront', 'licensePhotoBack'];
    
    // Check if ANY of the verification-required fields are being changed
    const requiresVerification = verificationRequiredFields.some(field => 
      fieldsBeingUpdated.includes(field)
    );
    
    console.log("🔍 Requires re-verification:", requiresVerification);

    // Only update verification status if verification-required fields changed
    if (requiresVerification) {
      console.log("⚠️ Re-verification required due to changes in:", 
        fieldsBeingUpdated.filter(field => verificationRequiredFields.includes(field)));
      
      updateData.verificationStatus = 'pending';
      updateData.verificationRequestedAt = new Date();
      updateData.rejectionReason = undefined; // Clear rejection reason
    } else {
      console.log("✅ No re-verification needed - only non-critical fields changed");
    }

    const profile = await DriverProfile.findOneAndUpdate(
      { userId: req.userId },
      updateData,
      { new: true, runValidators: true }
    );

    // Create new verification request ONLY if verification is required
    if (requiresVerification) {
      try {
        // First, cancel any existing pending verification requests
        await VerificationRequest.updateMany(
          { driverId: req.userId, status: 'pending' },
          { status: 'cancelled', notes: 'Superseded by profile update' }
        );
        
        // Create new verification request
        await autoCreateVerificationRequest(req.userId, profile);
        console.log("✅ New verification request created for updated profile");
      } catch (verificationError) {
        console.error("⚠️ Failed to create verification request:", verificationError);
      }
    }

    const message = requiresVerification ? 
      "Driver profile updated and resubmitted for verification (only critical fields require re-verification)" : 
      "Driver profile updated successfully - no re-verification needed";

    res.status(200).json({
      success: true,
      message: message,
      profile: profile,
      requiresVerification: requiresVerification,
      changedFields: fieldsBeingUpdated
    });

  } catch (err) {
    console.error("❌ [UPDATE DRIVER PROFILE ERROR]:", err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// Rest of the functions remain the same...
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

const getDriverProfile = async (req, res) => {
  try {
    console.log("📌 [FETCH] Driver Profile Request");
    console.log("🔑 Authenticated UID:", req.userId);

    // Get both user and profile data
    const user = await User.findOne({ googleId: req.userId });
    const profile = await DriverProfile.findOne({ userId: req.userId });

    console.log("👤 User found:", !!user);
    console.log("📋 Profile found:", !!profile);

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

    console.log("✅ Profile found with verification status:", profile.verificationStatus);
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

const updateUserInfo = async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: "Name and phone are required"
      });
    }

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
    } else {
      photoUrl = profile.photoUrl;
      updateField = 'photoUrl';
    }

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

    if (location) matchConditions['profile.location'] = new RegExp(location, 'i');

    let truckTypeFilter = {};
    if (truckType) truckTypeFilter = {
      'profile.knownTruckTypes': new RegExp(truckType, 'i')
    };

    const availableDrivers = await User.aggregate([
      { $match: { role: 'driver', isAvailable: true } },
      {
        $lookup: {
          from: 'driverprofiles',
          localField: 'googleId',
          foreignField: 'userId',
          as: 'profile'
        }
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      { $match: { ...matchConditions, ...truckTypeFilter } },
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
          truckTypes: '$profile.knownTruckTypes',
          licensePhotoFront: '$profile.licensePhotoFront',
          licensePhotoBack: '$profile.licensePhotoBack'
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
