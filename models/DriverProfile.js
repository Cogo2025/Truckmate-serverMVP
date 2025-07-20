const mongoose = require('mongoose');

const driverProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  licensePhoto: String,
  profilePhoto: String, // ✅ NEW: Added profile photo field
  licenseType: String,
  licenseNumber: String,
  licenseExpiryDate: Date,
  knownTruckTypes: [String],
  experience: String,
  gender: String,
  age: Number,
  location: String,
  profileCompleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('DriverProfile', driverProfileSchema);