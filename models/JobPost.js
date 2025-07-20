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
  lorryPhotos: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        // Validate each URL in the array
        return arr.every(url => {
          try {
            new URL(url);
            return true;
          } catch (e) {
            return false;
          }
        });
      },
      message: props => `${props.value} contains invalid URLs`
    }
  },
  ownerId: { type: String, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('JobPost', jobSchema);