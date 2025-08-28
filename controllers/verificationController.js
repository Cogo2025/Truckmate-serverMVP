const VerificationRequest = require('../models/VerificationRequest');
const DriverProfile = require('../models/DriverProfile');
const User = require('../models/User');

// Create verification request after driver profile completion
const createVerificationRequest = async (req, res) => {
  try {
    const driverProfile = await DriverProfile.findOne({ userId: req.userId });
    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Check if verification request already exists
    const existingRequest = await VerificationRequest.findOne({
      driverId: req.userId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ 
        error: "Verification request already pending",
        existingRequestId: existingRequest._id
      });
    }

    // Create verification request with updated document structure
    const verificationRequest = await VerificationRequest.create({
      driverId: req.userId,
      profileId: driverProfile._id,
      documents: {
        licensePhotoFront: driverProfile.licensePhotoFront,  // Updated field
        licensePhotoBack: driverProfile.licensePhotoBack,    // Updated field
        profilePhoto: driverProfile.profilePhoto
      }
    });

    // Update driver profile status
    await DriverProfile.findByIdAndUpdate(driverProfile._id, {
      verificationStatus: 'pending',
      verificationRequestedAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: "Verification request submitted successfully",
      requestId: verificationRequest._id
    });
  } catch (err) {
    console.error('❌ Create verification error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all pending verification requests (Admin only)
const getPendingVerifications = async (req, res) => {
  try {
    const requests = await VerificationRequest.aggregate([
      { $match: { status: 'pending' } },
      {
        $lookup: {
          from: 'users',
          localField: 'driverId',
          foreignField: 'googleId',
          as: 'driver'
        }
      },
      {
        $lookup: {
          from: 'driverprofiles',
          localField: 'profileId',
          foreignField: '_id',
          as: 'profile'
        }
      },
      { $unwind: { path: '$driver', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          driverId: 1,
          status: 1,
          priority: 1,
          createdAt: 1,
          'driver.name': { $ifNull: ['$driver.name', 'Unknown Driver'] },
          'driver.email': { $ifNull: ['$driver.email', 'N/A'] },
          'driver.phone': { $ifNull: ['$driver.phone', 'N/A'] },
          'profile.name': { $ifNull: ['$profile.name', 'N/A'] },
          'profile.licenseNumber': { $ifNull: ['$profile.licenseNumber', 'N/A'] },
          'profile.licenseType': { $ifNull: ['$profile.licenseType', 'N/A'] },
          'profile.licenseExpiryDate': 1,
          'profile.experience': { $ifNull: ['$profile.experience', 'N/A'] },
          'profile.location': { $ifNull: ['$profile.location', 'N/A'] },
          'profile.age': { $ifNull: ['$profile.age', 'N/A'] },
          'profile.gender': { $ifNull: ['$profile.gender', 'N/A'] },
          'profile.knownTruckTypes': { $ifNull: ['$profile.knownTruckTypes', []] },
          documents: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    console.log(`✅ Found ${requests.length} pending verification requests`);
    res.status(200).json(requests);
  } catch (err) {
    console.error('❌ Get pending verifications error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Approve/Reject verification (Admin only)
const processVerification = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, notes } = req.body;

    console.log(`📝 Processing verification: ${requestId} with action: ${action}`);

    const request = await VerificationRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: "Verification request not found" });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: "Request already processed" });
    }

    // Update verification request
    request.status = action;
    request.processedBy = req.adminId;
    request.processedAt = new Date();
    request.notes = notes;
    await request.save();

    // Update driver profile
    const updateData = { verificationStatus: action };
    if (action === 'approved') {
      updateData.approvedBy = req.adminId;
      updateData.approvedAt = new Date();
      updateData.rejectionReason = undefined; // Clear any previous rejection reason
    } else if (action === 'rejected') {
      updateData.rejectionReason = notes || 'No specific reason provided';
      updateData.$inc = { resubmissionCount: 1 };
    }

    await DriverProfile.findByIdAndUpdate(request.profileId, updateData);

    console.log(`✅ Driver ${action} successfully`);
    res.status(200).json({
      success: true,
      message: `Driver ${action} successfully`,
      requestId: request._id
    });
  } catch (err) {
    console.error('❌ Process verification error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get verification statistics for dashboard
const getVerificationStats = async (req, res) => {
  try {
    const [pending, approved, rejected] = await Promise.all([
      VerificationRequest.countDocuments({ status: 'pending' }),
      VerificationRequest.countDocuments({ status: 'approved' }),
      VerificationRequest.countDocuments({ status: 'rejected' })
    ]);

    res.status(200).json({
      success: true,
      stats: { pending, approved, rejected }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all verifications (Admin panel - this is what "view all" should call)
const getAllVerifications = async (req, res) => {
  try {
    console.log('📥 Fetching all verifications...');
    
    const requestCount = await VerificationRequest.countDocuments();
    console.log(`Found ${requestCount} total verification requests`);
    
    if (requestCount === 0) {
      return res.status(200).json([]);
    }

    const requests = await VerificationRequest.aggregate([
      // Match all requests (no filter)
      {
        $lookup: {
          from: 'users',
          localField: 'driverId',
          foreignField: 'googleId',
          as: 'driver'
        }
      },
      {
        $lookup: {
          from: 'driverprofiles',
          localField: 'profileId',
          foreignField: '_id',
          as: 'profile'
        }
      },
      {
        $unwind: {
          path: '$driver',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$profile',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          driverId: 1,
          status: 1,
          priority: 1,
          createdAt: 1,
          processedAt: 1,
          processedBy: 1,
          notes: 1,
          'driver.name': { $ifNull: ['$driver.name', 'Unknown Driver'] },
          'driver.email': { $ifNull: ['$driver.email', 'N/A'] },
          'driver.phone': { $ifNull: ['$driver.phone', 'N/A'] },
          'profile.name': { $ifNull: ['$profile.name', 'N/A'] },
          'profile.licenseNumber': { $ifNull: ['$profile.licenseNumber', 'N/A'] },
          'profile.licenseType': { $ifNull: ['$profile.licenseType', 'N/A'] },
          'profile.licenseExpiryDate': 1,
          'profile.experience': { $ifNull: ['$profile.experience', 'N/A'] },
          'profile.location': { $ifNull: ['$profile.location', 'N/A'] },
          'profile.age': { $ifNull: ['$profile.age', 'N/A'] },
          'profile.gender': { $ifNull: ['$profile.gender', 'N/A'] },
          'profile.knownTruckTypes': { $ifNull: ['$profile.knownTruckTypes', []] },
          documents: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    console.log(`✅ Successfully fetched ${requests.length} verification requests`);
    res.status(200).json(requests);
  } catch (err) {
    console.error('❌ Error fetching all verifications:', err);
    res.status(500).json({
      error: 'Failed to fetch verification history',
      details: err.message
    });
  }
};

// Get driver verification status
const getDriverVerificationStatus = async (req, res) => {
  try {
    const driverId = req.userId;
    
    // Check if driver profile exists
    const driverProfile = await DriverProfile.findOne({ userId: driverId });
    if (!driverProfile) {
      return res.status(404).json({
        error: "Driver profile not found",
        status: 'no_profile',
        canAccessJobs: false
      });
    }

    // Get latest verification request
    const latestRequest = await VerificationRequest.findOne({
      driverId: driverId
    }).sort({ createdAt: -1 });

    const response = {
      profileExists: true,
      verificationStatus: driverProfile.verificationStatus,
      canAccessJobs: driverProfile.verificationStatus === 'approved',
      profileCompleted: driverProfile.profileCompleted,
      verificationRequest: latestRequest ? {
        id: latestRequest._id,
        status: latestRequest.status,
        submittedAt: latestRequest.createdAt,
        processedAt: latestRequest.processedAt,
        notes: latestRequest.notes
      } : null
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('Error getting verification status:', err);
    res.status(500).json({ error: err.message });
  }
};

// Check if driver can access protected features
const checkDriverAccess = async (req, res) => {
  try {
    const driverId = req.userId;
    const driverProfile = await DriverProfile.findOne({ userId: driverId });
    const canAccess = driverProfile && driverProfile.verificationStatus === 'approved';

    res.status(200).json({
      canAccessJobs: canAccess,
      verificationStatus: driverProfile?.verificationStatus || 'no_profile',
      message: canAccess ? 'Access granted' : 'Verification required'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Resubmit verification after rejection
const resubmitVerification = async (req, res) => {
  try {
    const driverId = req.userId;
    const driverProfile = await DriverProfile.findOne({ userId: driverId });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (driverProfile.verificationStatus !== 'rejected') {
      return res.status(400).json({ error: "Can only resubmit rejected verifications" });
    }

    // Create new verification request
    const verificationRequest = await VerificationRequest.create({
      driverId: driverId,
      profileId: driverProfile._id,
      documents: {
        licensePhotoFront: driverProfile.licensePhotoFront,
        licensePhotoBack: driverProfile.licensePhotoBack,
        profilePhoto: driverProfile.profilePhoto
      }
    });

    // Update driver profile
    await DriverProfile.findByIdAndUpdate(driverProfile._id, {
      verificationStatus: 'pending',
      verificationRequestedAt: new Date(),
      $inc: { resubmissionCount: 1 }
    });

    res.status(201).json({
      success: true,
      message: "Verification resubmitted successfully",
      requestId: verificationRequest._id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createVerificationRequest,
  getPendingVerifications,
  processVerification,
  getVerificationStats,
  getAllVerifications,
  getDriverVerificationStatus,
  checkDriverAccess,
  resubmitVerification
};
