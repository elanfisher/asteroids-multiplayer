const { v4: uuidv4 } = require('uuid');
const { handlePlayerMovement, handlePlayerShoot } = require('./gameLogic');

// Constants
// Remove decision rate limitation - AI will make decisions every frame
const AI_MOVEMENT_UPDATE_RATE = 2; // Update movement every 2 frames for smoother transitions
const AI_SHOOT_PROBABILITY = 0.9; // 90% chance to shoot when aiming at target (increased from 80%)
const AI_DIFFICULTY_LEVELS = {
  easy: {
    accuracy: 0.6, // 60% accuracy
    reactionTime: 15, // 0.25 seconds at 60 FPS
    avoidanceDistance: 100,
    aggressiveness: 0.5, // 50% aggressive (prefers asteroids)
    movementSmoothing: 0.1, // Smooth movement transitions
    shootingRange: 500, // Maximum distance to consider shooting
    shootCooldown: 30 // Frames between shots (0.5 seconds)
  },
  medium: {
    accuracy: 0.75, // 75% accuracy
    reactionTime: 10, // 0.17 seconds at 60 FPS
    avoidanceDistance: 150,
    aggressiveness: 0.7, // 70% aggressive (balanced)
    movementSmoothing: 0.15, // Smooth movement transitions
    shootingRange: 600, // Maximum distance to consider shooting
    shootCooldown: 20 // Frames between shots (0.33 seconds)
  },
  hard: {
    accuracy: 0.9, // 90% accuracy
    reactionTime: 5, // 0.08 seconds at 60 FPS
    avoidanceDistance: 200,
    aggressiveness: 0.9, // 90% aggressive (prefers players)
    movementSmoothing: 0.2, // Smooth movement transitions
    shootingRange: 700, // Maximum distance to consider shooting
    shootCooldown: 15 // Frames between shots (0.25 seconds)
  }
};

// Spawn AI players
function spawnAI(game, count) {
  for (let i = 0; i < count; i++) {
    const id = `ai-${uuidv4()}`;
    const difficulty = getRandomDifficulty();
    
    game.players[id] = {
      id,
      userId: `ai-${i}`,
      x: Math.random() * game.width,
      y: Math.random() * game.height,
      rotation: Math.random() * Math.PI * 2,
      speed: 0,
      score: 0,
      lives: 3,
      isAI: true,
      radius: require('./gameLogic').PLAYER_RADIUS,
      aiState: {
        difficulty,
        targetAsteroid: null,
        lastDecision: 0,
        avoidingAsteroid: null,
        avoidingUntil: 0,
        lastShot: 0,
        ...AI_DIFFICULTY_LEVELS[difficulty]
      }
    };
  }
}

// Get random AI difficulty
function getRandomDifficulty() {
  const difficulties = Object.keys(AI_DIFFICULTY_LEVELS);
  const randomIndex = Math.floor(Math.random() * difficulties.length);
  return difficulties[randomIndex];
}

// Update AI player
function updateAI(game, aiPlayer) {
  // Initialize AI state if needed
  if (!aiPlayer.aiState.targetRotation) {
    aiPlayer.aiState.targetRotation = aiPlayer.rotation;
    aiPlayer.aiState.targetThrust = false;
  }
  
  // Make decisions every frame - no rate limiting
  
  // Find closest asteroid
  const closestAsteroid = findClosestAsteroid(game, aiPlayer);
  
  // Find closest player
  const closestPlayer = findClosestPlayer(game, aiPlayer);
  
  // Determine target based on difficulty and distances
  const target = determineTarget(aiPlayer, closestAsteroid, closestPlayer);
  
  // Store target for smoother transitions
  aiPlayer.aiState.currentTarget = target;
  
  // Determine movement
  if (target) {
    const movement = determineMovement(game, aiPlayer, target);
    
    // Store target rotation and thrust for smooth transitions
    if (movement.rotateLeft) {
      aiPlayer.aiState.targetRotation = aiPlayer.rotation - Math.PI / 8;
    } else if (movement.rotateRight) {
      aiPlayer.aiState.targetRotation = aiPlayer.rotation + Math.PI / 8;
    }
    
    aiPlayer.aiState.targetThrust = movement.thrust;
  }
  
  // Determine shooting
  const shouldShootNow = shouldShoot(game, aiPlayer, target);
  
  // If AI should shoot, call handlePlayerShoot
  if (shouldShootNow) {
    console.log(`AI ${aiPlayer.id} SHOOTING at target!`);
    handlePlayerShoot(game, aiPlayer.id);
    
    // Record last shot time
    aiPlayer.lastShot = game.frameCount;
    aiPlayer.aiState.lastShot = game.frameCount;
  }
  
  // Update movement more frequently for smoother transitions
  if (game.frameCount % AI_MOVEMENT_UPDATE_RATE === 0) {
    // Smoothly rotate towards target rotation
    const rotDiff = aiPlayer.aiState.targetRotation - aiPlayer.rotation;
    
    // Normalize angle difference to [-PI, PI]
    let normalizedRotDiff = rotDiff;
    while (normalizedRotDiff > Math.PI) normalizedRotDiff -= 2 * Math.PI;
    while (normalizedRotDiff < -Math.PI) normalizedRotDiff += 2 * Math.PI;
    
    // Determine rotation direction
    if (normalizedRotDiff > 0.05) {
      aiPlayer.rotateLeft = false;
      aiPlayer.rotateRight = true;
    } else if (normalizedRotDiff < -0.05) {
      aiPlayer.rotateLeft = true;
      aiPlayer.rotateRight = false;
    } else {
      aiPlayer.rotateLeft = false;
      aiPlayer.rotateRight = false;
    }
    
    // Update thrust
    aiPlayer.thrust = aiPlayer.aiState.targetThrust;
  }
  
  // Always update position for smooth movement
  if (aiPlayer.rotateLeft) {
    aiPlayer.rotation -= 0.1; // Match player rotation speed
  }
  if (aiPlayer.rotateRight) {
    aiPlayer.rotation += 0.1; // Match player rotation speed
  }
  
  if (aiPlayer.thrust) {
    aiPlayer.speed += 0.2; // Match player acceleration
    if (aiPlayer.speed > 5) { // Match player max speed
      aiPlayer.speed = 5;
    }
  } else {
    aiPlayer.speed *= 0.98; // Match player friction
  }
  
  // Update position
  // Adjust rotation by -PI/2 to match ship's orientation
  const adjustedRotation = aiPlayer.rotation - Math.PI / 2;
  aiPlayer.x += Math.cos(adjustedRotation) * aiPlayer.speed;
  aiPlayer.y += Math.sin(adjustedRotation) * aiPlayer.speed;
  
  // Wrap around screen edges
  if (aiPlayer.x < 0) aiPlayer.x = game.width;
  if (aiPlayer.x > game.width) aiPlayer.x = 0;
  if (aiPlayer.y < 0) aiPlayer.y = game.height;
  if (aiPlayer.y > game.height) aiPlayer.y = 0;
}

// Find the closest player to the AI
function findClosestPlayer(game, aiPlayer) {
  let closestPlayer = null;
  let closestDistance = Infinity;
  
  for (const playerId in game.players) {
    const player = game.players[playerId];
    
    // Skip self
    if (player.id === aiPlayer.id) {
      continue;
    }
    
    // Skip dead players
    if (player.lives <= 0) {
      continue;
    }
    
    // Skip invulnerable players
    if (player.invulnerable && game.frameCount < player.invulnerableUntil) {
      continue;
    }
    
    const dx = player.x - aiPlayer.x;
    const dy = player.y - aiPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPlayer = player;
    }
  }
  
  return closestPlayer;
}

// Determine whether to target asteroid or player
function determineTarget(aiPlayer, closestAsteroid, closestPlayer) {
  // If only one target exists, use that
  if (!closestAsteroid) return closestPlayer;
  if (!closestPlayer) return closestAsteroid;
  
  // Get aggressiveness from difficulty level
  const aggressiveness = aiPlayer.aiState.aggressiveness;
  
  // Calculate distances
  const dxAsteroid = closestAsteroid.x - aiPlayer.x;
  const dyAsteroid = closestAsteroid.y - aiPlayer.y;
  const asteroidDistance = Math.sqrt(dxAsteroid * dxAsteroid + dyAsteroid * dyAsteroid);
  
  const dxPlayer = closestPlayer.x - aiPlayer.x;
  const dyPlayer = closestPlayer.y - aiPlayer.y;
  const playerDistance = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);
  
  // Normalize distances (closer = higher value)
  const normalizedAsteroidDistance = 1000 / (asteroidDistance + 100);
  const normalizedPlayerDistance = 1000 / (playerDistance + 100);
  
  // Calculate target scores
  const asteroidScore = normalizedAsteroidDistance * (1 - aggressiveness);
  const playerScore = normalizedPlayerDistance * aggressiveness;
  
  // Choose target with higher score
  return asteroidScore > playerScore ? closestAsteroid : closestPlayer;
}

// Find closest asteroid to player
function findClosestAsteroid(game, player) {
  let closestAsteroid = null;
  let closestDistance = Infinity;
  
  Object.values(game.asteroids).forEach(asteroid => {
    const dx = asteroid.x - player.x;
    const dy = asteroid.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestAsteroid = asteroid;
    }
  });
  
  return closestAsteroid;
}

// Determine AI movement
function determineMovement(game, player, target) {
  const movement = {
    rotateLeft: false,
    rotateRight: false,
    thrust: false
  };
  
  // If no target, just move randomly
  if (!target) {
    movement.thrust = Math.random() > 0.5;
    movement.rotateLeft = Math.random() > 0.7;
    movement.rotateRight = !movement.rotateLeft && Math.random() > 0.7;
    return movement;
  }
  
  // Calculate angle to target
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const angleToTarget = Math.atan2(dy, dx);
  
  // Calculate difference between current rotation and angle to target
  // Adjust for ship orientation (ship points up at 0 rotation)
  const adjustedShipRotation = player.rotation - Math.PI / 2;
  let angleDiff = angleToTarget - adjustedShipRotation;
  
  // Normalize angle difference to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  // Calculate distance to target
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Check if we need to avoid the target (if it's an asteroid or we're too close to a player)
  const avoidanceDistance = player.aiState.avoidanceDistance;
  const shouldAvoid = (target.isAI === undefined && distance < avoidanceDistance) || 
                      (target.isAI !== undefined && distance < avoidanceDistance / 2);
  
  if (shouldAvoid) {
    // Avoid target by rotating away and thrusting
    movement.rotateLeft = angleDiff > 0;
    movement.rotateRight = angleDiff <= 0;
    movement.thrust = true;
    
    // Set avoiding state
    player.aiState.avoidingAsteroid = target.id;
    player.aiState.avoidingUntil = game.frameCount + player.aiState.reactionTime;
  } else if (game.frameCount < player.aiState.avoidingUntil) {
    // Continue avoiding
    movement.thrust = true;
  } else {
    // Target the object
    player.aiState.targetAsteroid = target.id;
    
    // Add some inaccuracy based on difficulty
    const inaccuracy = (1 - player.aiState.accuracy) * Math.PI / 2;
    angleDiff += (Math.random() * 2 - 1) * inaccuracy;
    
    // Rotate towards target
    movement.rotateLeft = angleDiff > 0.05;
    movement.rotateRight = angleDiff < -0.05;
    
    // Thrust if pointing approximately towards target
    movement.thrust = Math.abs(angleDiff) < Math.PI / 4;
  }
  
  return movement;
}

// Determine if AI should shoot
function shouldShoot(game, player, target) {
  if (!target) return false;
  
  // Calculate distance to target
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Don't shoot if target is too far away (based on difficulty)
  const maxShootingRange = player.aiState.shootingRange || 500;
  if (distance > maxShootingRange) return false;
  
  // Calculate angle to target
  const angleToTarget = Math.atan2(dy, dx);
  
  // Adjust for ship orientation (ship points up at 0 rotation)
  const adjustedShipRotation = player.rotation - Math.PI / 2;
  
  // Calculate difference between current rotation and angle to target
  let angleDiff = angleToTarget - adjustedShipRotation;
  
  // Normalize angle difference to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  // Higher probability to shoot at players than asteroids
  let shootProbability = target.isAI !== undefined ? 
    AI_SHOOT_PROBABILITY * 1.5 : // Player target (135% chance - will always shoot if aiming well)
    AI_SHOOT_PROBABILITY;      // Asteroid target (90% chance)
  
  // Increase probability based on how accurately we're aiming
  const aimingAccuracy = 1 - (Math.abs(angleDiff) / (Math.PI / 4));
  if (aimingAccuracy > 0) {
    shootProbability *= aimingAccuracy;
  } else {
    shootProbability = 0; // Don't shoot if not pointing in the general direction
  }
  
  // Check if enough time has passed since last shot (rate limiting based on difficulty)
  const shootCooldown = player.aiState.shootCooldown || 15;
  const canShoot = !player.lastShot || (game.frameCount - player.lastShot) > shootCooldown;
  
  // Debug log to help diagnose shooting issues
  if (Math.abs(angleDiff) < Math.PI / 8 && canShoot) {
    console.log(`AI ${player.id} considering shot: angle diff ${angleDiff.toFixed(2)}, prob ${shootProbability.toFixed(2)}, can shoot: ${canShoot}`);
  }
  
  // Shoot if pointing approximately towards target, random chance, and can shoot
  return Math.abs(angleDiff) < Math.PI / 8 && Math.random() < shootProbability && canShoot;
}

module.exports = {
  updateAI,
  spawnAI,
  AI_DIFFICULTY_LEVELS,
  addAIPlayer: function(game, difficulty) {
    // This is just a wrapper to maintain compatibility
    // The actual implementation is in server.js
    return require('../server').addAIPlayer(game, difficulty);
  }
}; 