// models/OwnerProfile.js
const mongoose = require('mongoose');

const ownerProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // ✅ Use String
  companyName: String,
  companyLocation: String,
    photoUrl: String, // Add this line

  companyInfoCompleted: { type: Boolean, default: false }
});

module.exports = mongoose.model('OwnerProfile', ownerProfileSchema);
