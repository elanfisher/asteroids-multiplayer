const { v4: uuidv4 } = require('uuid');

// Constants
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const ASTEROID_SIZES = {
  large: { radius: 50, points: 20 },
  medium: { radius: 30, points: 50 },
  small: { radius: 15, points: 100 }
};
const BULLET_SPEED = 10;
const BULLET_LIFETIME = 60; // frames
const PLAYER_ROTATION_SPEED = 0.1;
const PLAYER_ACCELERATION = 0.2;
const PLAYER_MAX_SPEED = 5;
const PLAYER_FRICTION = 0.98;
const PLAYER_INVULNERABILITY_TIME = 180; // 3 seconds at 60 FPS
const PLAYER_RADIUS = 20; // Player ship radius for collision detection
const WINNING_SCORE = 1000; // Score needed to win the game
const ASTEROID_SPEED_MULTIPLIER = 0.5; // Slow down asteroids (50% of original speed)

// Initialize a new game
function initGame() {
  const game = {
    id: uuidv4(),
    players: {},
    asteroids: {},
    bullets: {},
    frameCount: 0,
    gameWon: false,
    winner: null,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT
  };
  
  // Generate initial asteroids
  game.asteroids = generateAsteroids(5);
  
  return game;
}

// Generate initial asteroids
function generateAsteroids(count) {
  const asteroids = {};
  
  for (let i = 0; i < count; i++) {
    const id = uuidv4();
    const size = 'large';
    
    // Ensure asteroids don't spawn in the center where players start
    let x, y;
    do {
      x = Math.random() * CANVAS_WIDTH;
      y = Math.random() * CANVAS_HEIGHT;
    } while (
      Math.sqrt(Math.pow(x - CANVAS_WIDTH / 2, 2) + Math.pow(y - CANVAS_HEIGHT / 2, 2)) < 200
    );
    
    asteroids[id] = {
      id,
      x,
      y,
      size,
      radius: ASTEROID_SIZES[size].radius,
      // Slow down asteroid velocity
      velocityX: (Math.random() - 0.5) * 2 * ASTEROID_SPEED_MULTIPLIER,
      velocityY: (Math.random() - 0.5) * 2 * ASTEROID_SPEED_MULTIPLIER,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05 * ASTEROID_SPEED_MULTIPLIER
    };
  }
  
  return asteroids;
}

// Handle player movement
function handlePlayerMovement(game, playerId, movement) {
  const player = game.players[playerId];
  if (!player) return;
  
  // Update rotation
  if (movement.rotateLeft) {
    player.rotation -= PLAYER_ROTATION_SPEED;
  }
  if (movement.rotateRight) {
    player.rotation += PLAYER_ROTATION_SPEED;
  }
  
  // Update acceleration
  if (movement.thrust) {
    player.speed += PLAYER_ACCELERATION;
    if (player.speed > PLAYER_MAX_SPEED) {
      player.speed = PLAYER_MAX_SPEED;
    }
  } else {
    player.speed *= PLAYER_FRICTION;
  }
  
  // Update position
  // Adjust rotation by -PI/2 to match ship's orientation
  const adjustedRotation = player.rotation - Math.PI / 2;
  player.x += Math.cos(adjustedRotation) * player.speed;
  player.y += Math.sin(adjustedRotation) * player.speed;
  
  // Wrap around screen edges
  if (player.x < 0) player.x = game.width;
  if (player.x > game.width) player.x = 0;
  if (player.y < 0) player.y = game.height;
  if (player.y > game.height) player.y = 0;
  
  return player;
}

// Handle player shooting
function handlePlayerShoot(game, playerId) {
  const player = game.players[playerId];
  if (!player) return null;
  
  // Check if player can shoot (rate limiting)
  const now = game.frameCount;
  if (player.lastShot && now - player.lastShot < 15) {
    return null;
  }
  
  // Create new bullet
  const bulletId = uuidv4();
  
  // Adjust rotation by -PI/2 to match ship's orientation
  // Ship points up at 0 rotation, but Math.cos/sin use right as 0 rotation
  const adjustedRotation = player.rotation - Math.PI / 2;
  
  const bullet = {
    id: bulletId,
    playerId,
    x: player.x + Math.cos(adjustedRotation) * 20,
    y: player.y + Math.sin(adjustedRotation) * 20,
    velocityX: Math.cos(adjustedRotation) * BULLET_SPEED,
    velocityY: Math.sin(adjustedRotation) * BULLET_SPEED,
    radius: 3,
    createdAt: now,
    expiresAt: now + BULLET_LIFETIME
  };
  
  // Add bullet to game
  game.bullets[bulletId] = bullet;
  
  // Update player's last shot time
  player.lastShot = now;
  
  return bullet;
}

// Check collision between two objects
function checkCollision(obj1, obj2) {
  const dx = obj1.x - obj2.x;
  const dy = obj1.y - obj2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance < obj1.radius + obj2.radius;
}

// Split asteroid into smaller pieces
function splitAsteroid(asteroid) {
  const newAsteroids = [];
  
  if (asteroid.size === 'large') {
    // Split large asteroid into two medium asteroids
    for (let i = 0; i < 2; i++) {
      newAsteroids.push({
        id: uuidv4(),
        x: asteroid.x,
        y: asteroid.y,
        size: 'medium',
        radius: ASTEROID_SIZES.medium.radius,
        velocityX: (asteroid.velocityX + (Math.random() - 0.5) * 2) * ASTEROID_SPEED_MULTIPLIER,
        velocityY: (asteroid.velocityY + (Math.random() - 0.5) * 2) * ASTEROID_SPEED_MULTIPLIER,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05 * ASTEROID_SPEED_MULTIPLIER
      });
    }
  } else if (asteroid.size === 'medium') {
    // Split medium asteroid into two small asteroids (reduced from three)
    for (let i = 0; i < 2; i++) {
      newAsteroids.push({
        id: uuidv4(),
        x: asteroid.x,
        y: asteroid.y,
        size: 'small',
        radius: ASTEROID_SIZES.small.radius,
        velocityX: (asteroid.velocityX + (Math.random() - 0.5) * 3) * ASTEROID_SPEED_MULTIPLIER,
        velocityY: (asteroid.velocityY + (Math.random() - 0.5) * 3) * ASTEROID_SPEED_MULTIPLIER,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1 * ASTEROID_SPEED_MULTIPLIER
      });
    }
  }
  
  return newAsteroids;
}

// Respawn player
function respawnPlayer(game, playerId) {
  const player = game.players[playerId];
  if (!player) return;
  
  // Check if player has lives left
  if (player.lives <= 0) {
    return;
  }
  
  // Reset player position and state
  player.x = Math.random() * game.width;
  player.y = Math.random() * game.height;
  player.rotation = 0;
  player.speed = 0;
  player.invulnerable = true;
  player.invulnerableUntil = game.frameCount + PLAYER_INVULNERABILITY_TIME;
  
  return player;
}

// Check if a player has won the game
function checkWinCondition(game) {
  // Find the player with the highest score
  let highestScore = 0;
  let winner = null;
  
  Object.values(game.players).forEach(player => {
    if (player.score > highestScore) {
      highestScore = player.score;
      winner = player;
    }
  });
  
  // Check if the highest score exceeds the winning threshold
  if (highestScore >= WINNING_SCORE) {
    return winner;
  }
  
  return null;
}

module.exports = {
  initGame,
  generateAsteroids,
  handlePlayerMovement,
  handlePlayerShoot,
  checkCollision,
  splitAsteroid,
  respawnPlayer,
  checkWinCondition,
  ASTEROID_SIZES,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAYER_RADIUS,
  WINNING_SCORE
}; 