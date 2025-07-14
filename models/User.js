const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  role: { type: String, enum: ['driver', 'owner'], required: true },
  name: String,
  phone: String,
  email: String,
  photoUrl: String,
  gender: String,
  location: String,
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);