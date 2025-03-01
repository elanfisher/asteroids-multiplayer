const mongoose = require('mongoose');

const ScoreSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  gameMode: {
    type: String,
    default: 'classic',
    enum: ['classic', 'survival', 'team']
  },
  details: {
    asteroidsDestroyed: {
      type: Number,
      default: 0
    },
    shipsSunk: {
      type: Number,
      default: 0
    },
    timeAlive: {
      type: Number,
      default: 0
    },
    level: {
      type: Number,
      default: 1
    }
  }
});

// Create index for faster querying
ScoreSchema.index({ score: -1 });
ScoreSchema.index({ user: 1, score: -1 });

module.exports = mongoose.model('Score', ScoreSchema); 