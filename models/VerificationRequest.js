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
    licensePhoto: String,
    profilePhoto: String,
    additionalDocs: [String]
  }
}, { timestamps: true });

module.exports = mongoose.model('VerificationRequest', verificationRequestSchema);
