const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  likedBy: { type: String, required: true }, // Using String to match user ID type
  likedType: { type: String, enum: ['job'], required: true },
  likedItemId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Job' }, // Changed to ObjectId
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