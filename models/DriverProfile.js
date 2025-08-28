const mongoose = require('mongoose');

const driverProfileSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true  // This ensures no duplicates
  },
  name: { type: String },
  profilePhoto: String,
  licensePhotoFront: String,
  licensePhotoBack: String,
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

// Add compound index for better performance and additional safety
driverProfileSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('DriverProfile', driverProfileSchema);
