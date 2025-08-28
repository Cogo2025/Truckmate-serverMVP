const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { 
    type: String, 
    required: true, 
    unique: true,  // Ensure no duplicate Google IDs
    index: true    // Index for faster lookups
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: { 
    type: String,
    required: true,
    trim: true
  },
  photoUrl: { 
    type: String,
    default: ''
  },
  role: { 
    type: String, 
    enum: ['driver', 'owner', 'admin', 'unassigned'],
    default: 'unassigned'
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isAvailable: { 
    type: Boolean, 
    default: false 
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  registrationCompleted: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for better performance
userSchema.index({ googleId: 1, role: 1 });
userSchema.index({ email: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);
