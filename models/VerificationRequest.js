// models/VerificationRequest.js
const mongoose = require('mongoose');

const verificationRequestSchema = new mongoose.Schema({
  driverId: {
    type: String,
    required: true,
    ref: 'User'
  },
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'DriverProfile'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  processedBy: {
    type: String,
    ref: 'Admin'
  },
  processedAt: Date,
  notes: String,
  documents: {
    licensePhotoFront: String,  // Updated from licensePhoto
    licensePhotoBack: String,   // Added back license photo
    profilePhoto: String,
    additionalDocs: [String]
  }
}, { timestamps: true });

// Index for better performance
verificationRequestSchema.index({ driverId: 1, status: 1 });
verificationRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('VerificationRequest', verificationRequestSchema);
