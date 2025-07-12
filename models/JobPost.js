const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  truckType: String,
  variant: {
    type: { type: String },
    wheelsOrFeet: String
  },
  sourceLocation: String,
  experienceRequired: String,
  dutyType: String,
  salaryType: String,
  salaryRange: {
    min: Number,
    max: Number
  },
  description: String,
  phone: String,
  lorryPhotos: [String],
  ownerId: { type: String, ref: 'User' } // Store Google ID (sub)
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
