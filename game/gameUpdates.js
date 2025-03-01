const { checkCollision, splitAsteroid, respawnPlayer, ASTEROID_SIZES, checkWinCondition, WINNING_SCORE } = require('./gameLogic');
const { v4: uuidv4 } = require('uuid');

// Update game state
function update(game) {
  const updates = [];
  
  // Check for win condition
  if (!game.gameWon) {
    const winner = checkWinCondition(game);
    if (winner) {
      game.gameWon = true;
      game.winner = winner.id;
      
      // Create stats for all players
      const playerStats = {};
      Object.values(game.players).forEach(player => {
        // Calculate accuracy
        const shotsFired = player.shotsFired || 0;
        const hitsOnAsteroids = player.hitsOnAsteroids || 0;
        const hitsOnPlayers = player.hitsOnPlayers || 0;
        const accuracy = shotsFired > 0 ? ((hitsOnAsteroids + hitsOnPlayers) / shotsFired * 100).toFixed(1) : '0.0';
        
        // Create a simplified player stats object to avoid circular references
        playerStats[player.id] = {
          id: player.id,
          userId: player.userId || 'Unknown',
          score: player.score || 0,
          shotsFired: shotsFired,
          hitsOnAsteroids: hitsOnAsteroids,
          hitsOnPlayers: hitsOnPlayers,
          accuracy: accuracy,
          isWinner: player.id === winner.id
        };
      });
      
      // Add game won update with only the necessary data
      updates.push({
        type: 'gameWon',
        winnerId: winner.id,
        winnerName: winner.userId || 'Unknown',
        winningScore: winner.score || 0,
        playerStats: playerStats
      });
      
      return updates;
    }
  }
  
  // Update asteroids
  updateAsteroids(game, updates);
  
  // Update bullets
  updateBullets(game, updates);
  
  // Check for collisions
  checkCollisions(game, updates);
  
  // Check if level is complete (no asteroids left)
  if (Object.keys(game.asteroids).length === 0) {
    const level = Math.floor((game.frameCount / 3600)) + 1; // New level every minute
    const newAsteroids = require('./gameLogic').generateAsteroids(3 + level); // Reduced number of asteroids
    
    game.asteroids = newAsteroids;
    updates.push({
      type: 'levelComplete',
      level,
      asteroids: newAsteroids
    });
  }
  
  return updates;
}

// Update asteroid positions
function updateAsteroids(game, updates) {
  Object.values(game.asteroids).forEach(asteroid => {
    // Update position
    asteroid.x += asteroid.velocityX;
    asteroid.y += asteroid.velocityY;
    asteroid.rotation += asteroid.rotationSpeed;
    
    // Wrap around screen edges
    if (asteroid.x < -asteroid.radius) asteroid.x = game.width + asteroid.radius;
    if (asteroid.x > game.width + asteroid.radius) asteroid.x = -asteroid.radius;
    if (asteroid.y < -asteroid.radius) asteroid.y = game.height + asteroid.radius;
    if (asteroid.y > game.height + asteroid.radius) asteroid.y = -asteroid.radius;
    
    // Add update
    updates.push({
      type: 'asteroidMoved',
      id: asteroid.id,
      x: asteroid.x,
      y: asteroid.y,
      rotation: asteroid.rotation
    });
  });
}

// Update bullet positions and lifetimes
function updateBullets(game, updates) {
  Object.values(game.bullets).forEach(bullet => {
    // Update position
    bullet.x += bullet.velocityX;
    bullet.y += bullet.velocityY;
    
    // Check if bullet is out of bounds
    if (
      bullet.x < 0 || 
      bullet.x > game.width || 
      bullet.y < 0 || 
      bullet.y > game.height ||
      game.frameCount > bullet.expiresAt
    ) {
      // Remove bullet
      delete game.bullets[bullet.id];
      
      // Add update
      updates.push({
        type: 'bulletRemoved',
        id: bullet.id
      });
    } else {
      // Add update
      updates.push({
        type: 'bulletMoved',
        id: bullet.id,
        x: bullet.x,
        y: bullet.y
      });
    }
  });
}

// Check for collisions
function checkCollisions(game, updates) {
  // Check bullet-asteroid collisions
  Object.values(game.bullets).forEach(bullet => {
    Object.values(game.asteroids).forEach(asteroid => {
      if (checkCollision(bullet, asteroid)) {
        // Remove bullet
        delete game.bullets[bullet.id];
        
        // Remove asteroid
        delete game.asteroids[asteroid.id];
        
        // Add score to player
        const player = game.players[bullet.playerId];
        if (player) {
          player.score += ASTEROID_SIZES[asteroid.size].points;
          
          // Track hits on asteroids
          player.hitsOnAsteroids = (player.hitsOnAsteroids || 0) + 1;
          
          // Add update
          updates.push({
            type: 'scoreUpdated',
            playerId: player.id,
            score: player.score
          });
          
          // Check if player has won
          if (player.score >= WINNING_SCORE && !game.gameWon) {
            game.gameWon = true;
            game.winner = player.id;
            
            // Create stats for all players
            const playerStats = {};
            Object.values(game.players).forEach(p => {
              // Calculate accuracy
              const shotsFired = p.shotsFired || 0;
              const hitsOnAsteroids = p.hitsOnAsteroids || 0;
              const hitsOnPlayers = p.hitsOnPlayers || 0;
              const accuracy = shotsFired > 0 ? ((hitsOnAsteroids + hitsOnPlayers) / shotsFired * 100).toFixed(1) : '0.0';
              
              // Create a simplified player stats object to avoid circular references
              playerStats[p.id] = {
                id: p.id,
                userId: p.userId || 'Unknown',
                score: p.score || 0,
                shotsFired: shotsFired,
                hitsOnAsteroids: hitsOnAsteroids,
                hitsOnPlayers: hitsOnPlayers,
                accuracy: accuracy,
                isWinner: p.id === player.id
              };
            });
            
            // Add game won update with only the necessary data
            updates.push({
              type: 'gameWon',
              winnerId: player.id,
              winnerName: player.userId || 'Unknown',
              winningScore: player.score || 0,
              playerStats: playerStats
            });
          }
        }
        
        // Split asteroid if not small
        if (asteroid.size !== 'small') {
          const newAsteroids = splitAsteroid(asteroid);
          
          // Add new asteroids to game
          newAsteroids.forEach(newAsteroid => {
            game.asteroids[newAsteroid.id] = newAsteroid;
          });
          
          // Add update
          updates.push({
            type: 'asteroidSplit',
            id: asteroid.id,
            newAsteroids
          });
        } else {
          // Add update
          updates.push({
            type: 'asteroidDestroyed',
            id: asteroid.id
          });
        }
        
        // Add update
        updates.push({
          type: 'bulletRemoved',
          id: bullet.id
        });
      }
    });
  });
  
  // Check player-asteroid collisions
  Object.values(game.players).forEach(player => {
    // Skip if player is invulnerable
    if (player.invulnerable && game.frameCount < player.invulnerableUntil) {
      return;
    } else if (player.invulnerable && game.frameCount >= player.invulnerableUntil) {
      // Remove invulnerability
      player.invulnerable = false;
      
      // Add update
      updates.push({
        type: 'playerVulnerable',
        id: player.id
      });
    }
    
    Object.values(game.asteroids).forEach(asteroid => {
      if (checkCollision(player, asteroid)) {
        // Reduce player lives
        player.lives--;
        
        // Add update
        updates.push({
          type: 'playerHit',
          id: player.id,
          lives: player.lives
        });
        
        if (player.lives <= 0) {
          // Game over for this player
          updates.push({
            type: 'playerGameOver',
            id: player.id,
            score: player.score
          });
          
          // If AI player, remove from game
          if (player.isAI) {
            delete game.players[player.id];
          }
        } else {
          // Respawn player
          respawnPlayer(game, player.id);
          
          // Add update
          updates.push({
            type: 'playerRespawned',
            id: player.id,
            x: player.x,
            y: player.y,
            rotation: player.rotation,
            invulnerable: player.invulnerable
          });
        }
      }
    });
    
    // Check player-player collisions (for multiplayer combat)
    Object.values(game.players).forEach(otherPlayer => {
      // Skip self or if either player is invulnerable
      if (player.id === otherPlayer.id || 
          player.invulnerable || 
          (otherPlayer.invulnerable && game.frameCount < otherPlayer.invulnerableUntil)) {
        return;
      }
      
      if (checkCollision(player, otherPlayer)) {
        // Both players lose a life in a collision
        player.lives--;
        otherPlayer.lives--;
        
        // Add updates
        updates.push({
          type: 'playerHit',
          id: player.id,
          lives: player.lives
        });
        
        updates.push({
          type: 'playerHit',
          id: otherPlayer.id,
          lives: otherPlayer.lives
        });
        
        // Handle player death
        if (player.lives <= 0) {
          updates.push({
            type: 'playerGameOver',
            id: player.id,
            score: player.score
          });
          
          // If AI player, remove from game
          if (player.isAI) {
            delete game.players[player.id];
          }
        } else {
          // Respawn player
          respawnPlayer(game, player.id);
          
          updates.push({
            type: 'playerRespawned',
            id: player.id,
            x: player.x,
            y: player.y,
            rotation: player.rotation,
            invulnerable: player.invulnerable
          });
        }
        
        // Handle other player death
        if (otherPlayer.lives <= 0) {
          updates.push({
            type: 'playerGameOver',
            id: otherPlayer.id,
            score: otherPlayer.score
          });
          
          // If AI player, remove from game
          if (otherPlayer.isAI) {
            delete game.players[otherPlayer.id];
          }
        } else {
          // Respawn other player
          respawnPlayer(game, otherPlayer.id);
          
          updates.push({
            type: 'playerRespawned',
            id: otherPlayer.id,
            x: otherPlayer.x,
            y: otherPlayer.y,
            rotation: otherPlayer.rotation,
            invulnerable: otherPlayer.invulnerable
          });
        }
      }
    });
  });
  
  // Check bullet-player collisions
  Object.values(game.bullets).forEach(bullet => {
    Object.values(game.players).forEach(player => {
      // Skip if bullet belongs to this player or if player is invulnerable
      if (bullet.playerId === player.id || 
          (player.invulnerable && game.frameCount < player.invulnerableUntil)) {
        return;
      }
      
      if (checkCollision(bullet, player)) {
        // Remove bullet
        delete game.bullets[bullet.id];
        
        // Reduce player lives
        player.lives--;
        
        // Add shooter score
        const shooter = game.players[bullet.playerId];
        if (shooter) {
          shooter.score += 200; // Points for hitting another player
          
          // Track hits on players
          shooter.hitsOnPlayers = (shooter.hitsOnPlayers || 0) + 1;
          
          updates.push({
            type: 'scoreUpdated',
            playerId: shooter.id,
            score: shooter.score
          });
          
          // Check if player has won
          if (shooter.score >= WINNING_SCORE && !game.gameWon) {
            game.gameWon = true;
            game.winner = shooter.id;
            
            // Create stats for all players
            const playerStats = {};
            Object.values(game.players).forEach(p => {
              // Calculate accuracy
              const shotsFired = p.shotsFired || 0;
              const hitsOnAsteroids = p.hitsOnAsteroids || 0;
              const hitsOnPlayers = p.hitsOnPlayers || 0;
              const accuracy = shotsFired > 0 ? ((hitsOnAsteroids + hitsOnPlayers) / shotsFired * 100).toFixed(1) : '0.0';
              
              // Create a simplified player stats object to avoid circular references
              playerStats[p.id] = {
                id: p.id,
                userId: p.userId || 'Unknown',
                score: p.score || 0,
                shotsFired: shotsFired,
                hitsOnAsteroids: hitsOnAsteroids,
                hitsOnPlayers: hitsOnPlayers,
                accuracy: accuracy,
                isWinner: p.id === shooter.id
              };
            });
            
            // Add game won update with only the necessary data
            updates.push({
              type: 'gameWon',
              winnerId: shooter.id,
              winnerName: shooter.userId || 'Unknown',
              winningScore: shooter.score || 0,
              playerStats: playerStats
            });
          }
        }
        
        // Add update
        updates.push({
          type: 'bulletRemoved',
          id: bullet.id
        });
        
        updates.push({
          type: 'playerHit',
          id: player.id,
          lives: player.lives
        });
        
        if (player.lives <= 0) {
          // Game over for this player
          updates.push({
            type: 'playerGameOver',
            id: player.id,
            score: player.score
          });
          
          // If AI player, remove from game
          if (player.isAI) {
            delete game.players[player.id];
          }
        } else {
          // Respawn player
          respawnPlayer(game, player.id);
          
          // Add update
          updates.push({
            type: 'playerRespawned',
            id: player.id,
            x: player.x,
            y: player.y,
            rotation: player.rotation,
            invulnerable: player.invulnerable
          });
        }
      }
    });
  });
}

module.exports = {
  update
}; 