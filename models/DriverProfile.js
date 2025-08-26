
const mongoose = require('mongoose');
const driverProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String }, 
  profilePhoto: String, // Cloudinary URL
  licensePhotoFront: String, // NEW: Front license photo URL
  licensePhotoBack: String,  // NEW: Back license photo URL
  licenseNumber: String,
  licenseExpiryDate: Date,
  knownTruckTypes: [String],
  experience: String,
  gender: String,
  age: Number,
  location: String,
  profileCompleted: { type: Boolean, default: false },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  verificationRequestedAt: Date,
  approvedBy: String,
  approvedAt: Date,
  rejectionReason: String,
  resubmissionCount: { type: Number, default: 0 }
}, { timestamps: true });


module.exports = mongoose.model('DriverProfile', driverProfileSchema);
