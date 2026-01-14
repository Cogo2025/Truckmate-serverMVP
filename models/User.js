const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: false,
    lowercase: true,
    trim: true,
    sparse: true,     // Changed: sparse index allows multiple nulls
    index: true       // Changed: Moved index option here
  },
  phone: { 
    type: String,
    required: true,
    trim: true,
    index: true
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
  },
  authProvider: {
    type: String,
    enum: ['google', 'phone'],
    default: 'phone'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for better performance
userSchema.index({ googleId: 1, role: 1 });
userSchema.index({ phone: 1, isActive: 1 });

// Removed: The old sparse index that was causing issues
// userSchema.index({ email: 1, isActive: 1 }, { sparse: true });

// Validation to ensure either email or phone exists
userSchema.pre('save', function(next) {
  if (!this.email && !this.phone) {
    next(new Error('Either email or phone must be provided'));
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
