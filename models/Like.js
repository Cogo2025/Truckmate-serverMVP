// Like.js
const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  likedBy: { type: String, required: true },
  likedType: { type: String, enum: ['job', 'driver'], required: true },
  likedItemId: { type: String, required: true }, // Changed to String to match user IDs
  likedDate: { type: Date, default: Date.now }
}, { 
  timestamps: true,
  indexes: [
    { 
      fields: { 
        likedBy: 1, 
        likedType: 1, 
        likedItemId: 1 
      },
      unique: true 
    }
  ]
});

module.exports = mongoose.model('Like', likeSchema);