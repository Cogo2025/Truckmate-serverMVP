// OwnerProfile.js - Updated model
const mongoose = require('mongoose');

const ownerProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  companyLocation: { type: String, required: true },
  gender: {
    type: String,
    required: true,
    enum: ['Male', 'Female', 'Other', 'Not Specified'],
    default: 'Not Specified'
  },
  photoUrl: { type: String }, // Store Base64 string directly
  companyInfoCompleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

ownerProfileSchema.index({ userId: 1 });

module.exports = mongoose.model('OwnerProfile', ownerProfileSchema);