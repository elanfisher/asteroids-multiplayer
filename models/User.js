const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  highScore: {
    type: Number,
    default: 0
  }
});

// Update lastLogin on user login
UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = Date.now();
  return this.save();
};

// Update high score if new score is higher
UserSchema.methods.updateHighScore = async function(score) {
  if (score > this.highScore) {
    this.highScore = score;
    return this.save();
  }
  return this;
};

module.exports = mongoose.model('User', UserSchema); 