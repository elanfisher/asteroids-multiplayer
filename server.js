require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const os = require('os'); // Added for network interface detection

// Import routes and game logic
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const gameLogic = require('./game/gameLogic');
const { initGame, handlePlayerMovement, handlePlayerShoot } = gameLogic;
const { spawnAI, updateAI } = require('./game/aiPlayers');

// Environment variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/asteroids';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_session_secret';

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Needed for game scripts
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "wss:", "ws:"] // For WebSocket connections
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Session configuration
const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: MONGODB_URI,
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native'
  }),
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    sameSite: 'strict'
  }
});

app.use(sessionMiddleware);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Create HTTP or HTTPS server based on environment
let server;
if (NODE_ENV === 'production' && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  const privateKey = fs.readFileSync(process.env.SSL_KEY_PATH, 'utf8');
  const certificate = fs.readFileSync(process.env.SSL_CERT_PATH, 'utf8');
  const credentials = { key: privateKey, cert: certificate };
  server = https.createServer(credentials, app);
  console.log('HTTPS server created');
} else {
  server = http.createServer(app);
  console.log('HTTP server created');
}

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: '*', // Allow connections from any origin
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Enable both WebSocket and polling for better compatibility
  pingTimeout: 60000, // Increase ping timeout for better mobile connectivity
  pingInterval: 25000 // Increase ping interval for better mobile connectivity
});

// Convert Express session middleware to Socket.IO middleware
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Game state
const games = {};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Authenticate user
  const userId = socket.request.session.userId || `guest-${uuidv4()}`;
  socket.userId = userId;
  
  // Join game
  socket.on('joinGame', (gameId = 'default') => {
    // Initialize game if it doesn't exist
    if (!games[gameId]) {
      games[gameId] = initGame();
      // Spawn AI players
      spawnAI(games[gameId], 2); // Reduced from 3 to 2 AI players
    }
    
    // Add player to game
    const player = {
      id: socket.id,
      userId: userId,
      x: Math.random() * 800,
      y: Math.random() * 600,
      rotation: 0,
      speed: 0,
      score: 0,
      lives: 3,
      isAI: false,
      radius: gameLogic.PLAYER_RADIUS,
      shotsFired: 0,
      hitsOnAsteroids: 0,
      hitsOnPlayers: 0
    };
    
    games[gameId].players[socket.id] = player;
    socket.join(gameId);
    socket.gameId = gameId;
    
    // Send current game state to the new player
    // Create a simplified game state to avoid circular references
    const safeGameState = {
      id: games[gameId].id,
      players: {},
      asteroids: {},
      bullets: {},
      frameCount: games[gameId].frameCount,
      gameWon: games[gameId].gameWon,
      winner: games[gameId].winner,
      width: games[gameId].width || gameLogic.CANVAS_WIDTH,
      height: games[gameId].height || gameLogic.CANVAS_HEIGHT
    };
    
    // Create safe copies of asteroids
    Object.keys(games[gameId].asteroids).forEach(asteroidId => {
      const asteroid = games[gameId].asteroids[asteroidId];
      if (asteroid) {
        safeGameState.asteroids[asteroidId] = {
          id: asteroid.id,
          x: asteroid.x,
          y: asteroid.y,
          size: asteroid.size,
          radius: asteroid.radius,
          velocityX: asteroid.velocityX,
          velocityY: asteroid.velocityY,
          rotation: asteroid.rotation,
          rotationSpeed: asteroid.rotationSpeed
        };
      }
    });
    
    // Create safe copies of bullets
    Object.keys(games[gameId].bullets).forEach(bulletId => {
      const bullet = games[gameId].bullets[bulletId];
      if (bullet) {
        safeGameState.bullets[bulletId] = {
          id: bullet.id,
          x: bullet.x,
          y: bullet.y,
          velocityX: bullet.velocityX,
          velocityY: bullet.velocityY,
          playerId: bullet.playerId,
          radius: 3 // Add bullet radius for rendering
        };
      }
    });
    
    // Create simplified player objects
    Object.keys(games[gameId].players).forEach(playerId => {
      const player = games[gameId].players[playerId];
      safeGameState.players[playerId] = {
        id: player.id,
        userId: player.userId,
        name: player.name,
        x: player.x,
        y: player.y,
        rotation: player.rotation,
        thrusting: player.thrusting,
        lives: player.lives,
        score: player.score,
        invulnerable: player.invulnerable,
        gameOver: player.gameOver,
        shotsHitAsteroids: player.shotsHitAsteroids || 0,
        shotsHitPlayers: player.shotsHitPlayers || 0,
        shotsFired: player.shotsFired || 0
      };
    });
    
    socket.emit('gameState', safeGameState);
    
    // Notify other players
    socket.to(gameId).emit('playerJoined', player);
  });
  
  // Handle player movement
  socket.on('playerMovement', (movement) => {
    if (!socket.gameId || !games[socket.gameId]) return;
    
    handlePlayerMovement(games[socket.gameId], socket.id, movement);
    socket.to(socket.gameId).emit('playerMoved', {
      id: socket.id,
      ...movement
    });
  });
  
  // Handle player shooting
  socket.on('playerShoot', () => {
    if (!socket.gameId || !games[socket.gameId]) return;
    
    const bullet = handlePlayerShoot(games[socket.gameId], socket.id);
    if (bullet) {
      // Track shots fired
      if (games[socket.gameId].players[socket.id]) {
        games[socket.gameId].players[socket.id].shotsFired = 
          (games[socket.gameId].players[socket.id].shotsFired || 0) + 1;
      }
      
      // Emit to all players in the game, including the shooter
      io.to(socket.gameId).emit('bulletCreated', bullet);
    }
  });
  
  // Handle game restart
  socket.on('restartGame', () => {
    if (!socket.gameId || !games[socket.gameId]) return;
    
    const gameId = socket.gameId;
    const game = games[gameId];
    
    // Reset game state
    game.gameWon = false;
    game.winner = null;
    
    // Reset all players
    Object.values(game.players).forEach(player => {
      player.score = 0;
      player.lives = 3;
      player.shotsFired = 0;
      player.hitsOnAsteroids = 0;
      player.hitsOnPlayers = 0;
      player.x = Math.random() * gameLogic.CANVAS_WIDTH;
      player.y = Math.random() * gameLogic.CANVAS_HEIGHT;
      player.rotation = Math.random() * Math.PI * 2;
      player.speed = 0;
      player.invulnerable = true;
      player.invulnerableUntil = game.frameCount + 180; // 3 seconds at 60 FPS
    });
    
    // Clear bullets
    game.bullets = {};
    
    // Generate new asteroids
    game.asteroids = gameLogic.generateAsteroids(5); // Start with 5 asteroids
    
    // Notify all players of game restart
    io.to(gameId).emit('gameRestarted', game);
  });
  
  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (socket.gameId && games[socket.gameId]) {
      // Remove player from game
      delete games[socket.gameId].players[socket.id];
      
      // Notify other players
      socket.to(socket.gameId).emit('playerLeft', socket.id);
      
      // Clean up empty games
      if (Object.keys(games[socket.gameId].players).filter(id => !games[socket.gameId].players[id].isAI).length === 0) {
        delete games[socket.gameId];
      }
    }
  });
});

// Add AI player
function addAIPlayer(game, difficulty = 'medium') {
  const id = `ai-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const difficultySettings = require('./game/aiPlayers').AI_DIFFICULTY_LEVELS[difficulty];
  
  // Ensure AI players spawn away from other players
  let x, y;
  let tooClose = true;
  let attempts = 0;
  
  while (tooClose && attempts < 10) {
    x = Math.random() * gameLogic.CANVAS_WIDTH;
    y = Math.random() * gameLogic.CANVAS_HEIGHT;
    tooClose = false;
    
    // Check distance from other players
    Object.values(game.players).forEach(player => {
      const dx = x - player.x;
      const dy = y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 200) { // Minimum distance from other players
        tooClose = true;
      }
    });
    
    attempts++;
  }
  
  // If we couldn't find a good spot after 10 attempts, just use a random position
  if (tooClose) {
    x = Math.random() * gameLogic.CANVAS_WIDTH;
    y = Math.random() * gameLogic.CANVAS_HEIGHT;
  }
  
  game.players[id] = {
    id,
    userId: `ai-${id.substring(3, 8)}`,
    x,
    y,
    rotation: Math.random() * Math.PI * 2,
    speed: 0,
    rotateLeft: false,
    rotateRight: false,
    thrust: false,
    shoot: false,
    score: 0,
    lives: 3,
    invulnerable: true,
    invulnerableUntil: game.frameCount + 180, // 3 seconds at 60 FPS
    lastShot: 0,
    isAI: true,
    radius: gameLogic.PLAYER_RADIUS,
    aiState: {
      difficulty,
      lastDecision: 0,
      targetAsteroid: null,
      targetRotation: Math.random() * Math.PI * 2,
      targetThrust: false,
      currentTarget: null,
      avoidingAsteroid: null,
      avoidingUntil: 0,
      ...difficultySettings
    }
  };
  
  return id;
}

// Game update loop
const FPS = 60;
setInterval(() => {
  // Update all active games
  Object.keys(games).forEach(gameId => {
    const game = games[gameId];
    game.frameCount++;
    
    // Skip updates if game is won
    if (game.gameWon) {
      return;
    }
    
    // Ensure game dimensions are set
    if (!game.width) game.width = gameLogic.CANVAS_WIDTH;
    if (!game.height) game.height = gameLogic.CANVAS_HEIGHT;
    
    // Update AI players
    Object.values(game.players).forEach(player => {
      if (player.isAI) {
        updateAI(game, player);
      }
    });
    
    // Update game state (asteroids, bullets, collisions, etc.)
    const gameUpdates = require('./game/gameUpdates').update(game);
    
    // Check for any new bullets created by AI players and emit them
    Object.values(game.bullets).forEach(bullet => {
      // If this is a new bullet (created in the last frame) and from an AI player
      if (bullet.createdAt === game.frameCount - 1 && 
          game.players[bullet.playerId] && 
          game.players[bullet.playerId].isAI) {
        io.to(gameId).emit('bulletCreated', bullet);
      }
    });
    
    // Broadcast game updates to all players in the game
    if (gameUpdates.length > 0) {
      try {
        // Create a safe copy of game updates to avoid circular references
        const safeGameUpdates = gameUpdates.map(update => {
          // Create a new object with only the necessary properties
          const safeUpdate = { ...update };
          
          // Handle specific update types that might contain complex objects
          if (update.type === 'asteroidSplit' && update.newAsteroids) {
            safeUpdate.newAsteroids = update.newAsteroids.map(asteroid => ({
              id: asteroid.id,
              x: asteroid.x || 0,
              y: asteroid.y || 0,
              size: asteroid.size,
              radius: asteroid.radius || 0,
              velocityX: asteroid.velocityX || 0,
              velocityY: asteroid.velocityY || 0,
              rotation: asteroid.rotation || 0,
              rotationSpeed: asteroid.rotationSpeed || 0
            }));
          }
          
          return safeUpdate;
        });
        
        io.to(gameId).emit('gameUpdates', safeGameUpdates);
        
        // Check if game is won
        const gameWonUpdate = gameUpdates.find(update => update.type === 'gameWon');
        if (gameWonUpdate) {
          game.gameWon = true;
          game.winner = gameWonUpdate.winnerId;
          
          try {
            // Send a safe copy of the game won update to avoid circular references
            const safeGameWonUpdate = {
              type: gameWonUpdate.type,
              winnerId: gameWonUpdate.winnerId,
              winnerName: gameWonUpdate.winnerName || 'Unknown',
              winningScore: gameWonUpdate.winningScore || 0,
              playerStats: gameWonUpdate.playerStats || {},
              width: game.width,
              height: game.height
            };
            
            io.to(gameId).emit('gameWon', safeGameWonUpdate);
          } catch (error) {
            console.error('Error sending gameWon event:', error);
          }
        }
      } catch (error) {
        console.error('Error sending game updates:', error);
      }
    }
    
    // Send player positions and bullets more frequently (every 5 frames = 12 times per second)
    // This helps reduce rubber-banding while keeping bandwidth usage reasonable
    if (game.frameCount % 5 === 0) {
      try {
        const playerPositions = {};
        Object.values(game.players).forEach(player => {
          if (player) {
            playerPositions[player.id] = {
              id: player.id,
              x: player.x || 0,
              y: player.y || 0,
              rotation: player.rotation || 0,
              speed: player.speed || 0,
              thrust: player.thrust || false
            };
          }
        });
        
        // Include bullets in frequent updates to ensure consistent rendering
        const bulletPositions = {};
        Object.values(game.bullets).forEach(bullet => {
          if (bullet) {
            bulletPositions[bullet.id] = {
              id: bullet.id,
              x: bullet.x || 0,
              y: bullet.y || 0,
              velocityX: bullet.velocityX || 0,
              velocityY: bullet.velocityY || 0
            };
          }
        });
        
        // Always include game dimensions in positions updates
        io.to(gameId).emit('gamePositions', {
          players: playerPositions,
          bullets: bulletPositions,
          width: game.width,
          height: game.height
        });
      } catch (error) {
        console.error('Error sending game positions:', error);
      }
    }
    
    // Broadcast full game state less frequently (every 2 seconds)
    // This ensures eventual consistency without causing frequent rubber-banding
    if (game.frameCount % (FPS * 2) === 0) {
      try {
        // Create a simplified game state to avoid circular references
        const safeGameState = {
          id: game.id,
          players: {},
          asteroids: {},
          bullets: {},
          frameCount: game.frameCount,
          gameWon: game.gameWon,
          winner: game.winner,
          width: game.width,
          height: game.height
        };
        
        // Create safe copies of asteroids
        Object.keys(game.asteroids).forEach(asteroidId => {
          const asteroid = game.asteroids[asteroidId];
          if (asteroid) {
            safeGameState.asteroids[asteroidId] = {
              id: asteroid.id,
              x: asteroid.x,
              y: asteroid.y,
              size: asteroid.size,
              radius: asteroid.radius,
              velocityX: asteroid.velocityX,
              velocityY: asteroid.velocityY,
              rotation: asteroid.rotation,
              rotationSpeed: asteroid.rotationSpeed
            };
          }
        });
        
        // Create safe copies of bullets
        Object.keys(game.bullets).forEach(bulletId => {
          const bullet = game.bullets[bulletId];
          if (bullet) {
            safeGameState.bullets[bulletId] = {
              id: bullet.id,
              x: bullet.x,
              y: bullet.y,
              velocityX: bullet.velocityX,
              velocityY: bullet.velocityY,
              playerId: bullet.playerId
            };
          }
        });
        
        // Create simplified player objects
        Object.keys(game.players).forEach(playerId => {
          const player = game.players[playerId];
          if (player) {
            safeGameState.players[playerId] = {
              id: player.id,
              userId: player.userId || 'Unknown',
              name: player.name,
              x: player.x || 0,
              y: player.y || 0,
              rotation: player.rotation || 0,
              thrusting: player.thrusting || false,
              lives: player.lives || 0,
              score: player.score || 0,
              invulnerable: player.invulnerable || false,
              gameOver: player.gameOver || false,
              shotsHitAsteroids: player.shotsHitAsteroids || 0,
              shotsHitPlayers: player.shotsHitPlayers || 0,
              shotsFired: player.shotsFired || 0
            };
          }
        });
        
        io.to(gameId).emit('gameState', safeGameState);
      } catch (error) {
        console.error('Error sending game state:', error);
      }
    }
  });
}, 1000 / FPS); // 60 FPS (16.67ms per frame)

// Get local IP addresses for network play
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const interfaceName in interfaces) {
    const interfaceInfo = interfaces[interfaceName];
    for (const info of interfaceInfo) {
      // Skip internal and non-IPv4 addresses
      if (info.family === 'IPv4' && !info.internal) {
        addresses.push(info.address);
      }
    }
  }
  
  return addresses;
}

// Export functions
module.exports = {
  addAIPlayer
};

// Start server
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
  
  // Display local network addresses for easy connection
  const localIps = getLocalIpAddresses();
  if (localIps.length > 0) {
    console.log('\n=== GAME AVAILABLE AT THE FOLLOWING ADDRESSES ===');
    console.log(`Local: http://localhost:${PORT}`);
    localIps.forEach(ip => {
      console.log(`Network: http://${ip}:${PORT}`);
    });
    console.log('=================================================\n');
    console.log('Share any of the Network addresses with devices on your local network to play together!');
  } else {
    console.log(`Game available at: http://localhost:${PORT}`);
  }
}); 