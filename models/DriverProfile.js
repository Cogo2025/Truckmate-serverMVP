const mongoose = require('mongoose');

const driverProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  licensePhoto: String,
  profilePhoto: String,
  licenseType: String,
  licenseNumber: String,
  licenseExpiryDate: Date,
  knownTruckTypes: [String],
  experience: String,
  gender: String,
  age: Number,
  location: String,
  profileCompleted: { type: Boolean, default: false },
  
  // ✅ ADD: Verification fields
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
