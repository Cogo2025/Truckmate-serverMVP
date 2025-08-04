const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  truckType: { 
    type: String,
    enum: [
      "Body Vehicle", "Trailer", "Tipper", "Gas Tanker",
      "Wind Mill", "Concrete Mixer", "Petrol Tank",
      "Container", "Bulker"
    ]
  },
  variant: {
    type: { type: String },
    wheelsOrFeet: {
      type: String,
      validate: {
        validator: function(value) {
          if (this.truckType === "Body Vehicle") {
            return ["6 wheels", "8 wheels", "12 wheels", "14 wheels", "16 wheels"].includes(value);
          }
          return true; // No validation for other truck types
        },
        message: props => `Invalid wheels type for Body Vehicle`
      }
    }
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