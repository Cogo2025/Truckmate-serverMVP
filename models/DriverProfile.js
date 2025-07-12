const mongoose = require('mongoose');

const driverProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // Changed to String to match Google ID
  licensePhoto: String,
  knownTruckTypes: [String],
  experience: String,
  salaryRange: {
    min: Number,
    max: Number
  }
});

module.exports = mongoose.model('DriverProfile', driverProfileSchema);