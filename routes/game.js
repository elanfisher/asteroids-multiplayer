const express = require('express');
const router = express.Router();
const Score = require('../models/Score');

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Get top scores
router.get('/scores', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Get top scores
    const scores = await Score.find()
      .sort({ score: -1 })
      .limit(limit)
      .populate('user', 'username')
      .lean();
    
    res.json({ scores });
  } catch (err) {
    console.error('Get scores error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit a new score
router.post('/scores', isAuthenticated, async (req, res) => {
  try {
    const { score } = req.body;
    
    if (!score || typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }
    
    // Create new score
    const newScore = new Score({
      user: req.session.userId,
      score,
      date: new Date()
    });
    
    // Save score to database
    await newScore.save();
    
    res.status(201).json({ 
      message: 'Score submitted successfully',
      score: newScore
    });
  } catch (err) {
    console.error('Submit score error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's scores
router.get('/scores/me', isAuthenticated, async (req, res) => {
  try {
    // Get user's scores
    const scores = await Score.find({ user: req.session.userId })
      .sort({ score: -1 })
      .limit(10)
      .lean();
    
    res.json({ scores });
  } catch (err) {
    console.error('Get user scores error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get active games
router.get('/active', async (req, res) => {
  try {
    // This would typically query the active games from the server's memory
    // For now, we'll just return a placeholder
    res.json({ 
      activeGames: [
        { id: 'default', players: 0 }
      ]
    });
  } catch (err) {
    console.error('Get active games error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 