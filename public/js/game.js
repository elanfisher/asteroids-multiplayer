/**
 * Game Module
 * Handles game state, socket communication, and game logic
 */
const Game = (() => {
  // Game state
  let socket = null;
  let gameState = null;
  let playerId = null;
  let gameId = 'default';
  let isGameOver = false;
  let isGameWon = false;
  let lastServerUpdate = 0;
  let interpolationFactor = 0.1; // Reduced from 0.3 to give client more control
  let clientHasAuthority = true; // New flag to let client control movement without server override
  
  // Game timing variables
  let lastFrameTime = 0;
  let targetFPS = 60;
  let frameInterval = 1000 / targetFPS;
  let deltaTime = 0;
  
  // Game dimensions - explicitly define them with defaults
  let gameWidth = 3000;
  let gameHeight = 3000;
  
  // Movement speed factors - Further adjusted for better control
  const ROTATION_SPEED = 0.06;     // Reduced by half from 0.12
  const ACCELERATION = 0.2;       // Left as is
  const MAX_SPEED = 5.0;         // Left as is
  const FRICTION = 0.97;        // Left as is
  
  // Track last shoot time to prevent rapid firing
  let lastShootTime = 0;
  const SHOOT_COOLDOWN = 300; // 300ms cooldown between shots
  
  // Game notifications
  const NOTIFICATION_DURATION = 3000; // 3 seconds
  let activeNotifications = [];
  
  // Local player prediction state
  let lastSentUpdateTime = 0;
  const UPDATE_INTERVAL = 100; // Send updates every 100ms instead of randomly
  
  // DOM Elements
  const gameScreen = document.getElementById('game-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const gameWonScreen = document.getElementById('game-won-screen');
  const scoreDisplay = document.getElementById('score-display');
  const livesDisplay = document.getElementById('lives-display');
  const finalScoreDisplay = document.getElementById('final-score-display');
  const winnerNameDisplay = document.getElementById('winner-name');
  const winnerScoreDisplay = document.getElementById('winner-score');
  const playAgainBtn = document.getElementById('play-again-btn');
  const restartGameBtn = document.getElementById('restart-game-btn');
  const returnLobbyBtn = document.getElementById('return-lobby-btn');
  const returnLobbyFromWinBtn = document.getElementById('return-lobby-from-win-btn');
  const joinGameBtn = document.getElementById('join-game-btn');
  
  // Add mobile controls detection and setup
  let isMobile = false;
  let mobileControls = {
    thrust: false,
    rotateLeft: false,
    rotateRight: false,
    shoot: false
  };
  
  // Initialize game
  const init = () => {
    // Add event listeners
    joinGameBtn.addEventListener('click', startGame);
    playAgainBtn.addEventListener('click', restartGame);
    restartGameBtn.addEventListener('click', restartGame);
    returnLobbyBtn.addEventListener('click', returnToLobby);
    returnLobbyFromWinBtn.addEventListener('click', returnToLobby);
    
    // Initialize renderer first to create the canvas and assets
    Renderer.init();
    
    // Initialize controls
    Controls.init(socket);
    
    // Initialize socket connection
    initSocket();
  };
  
  // Initialize socket connection
  const initSocket = () => {
    // Connect to server with transport options
    socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket'],
      upgrade: false,
      query: {
        // Add a flag to identify as a guest client that doesn't need MongoDB authentication
        clientType: 'guest-client',
        skipAuth: true,
        resetState: true // Request server to reset state for this client
      }
    });
    
    // Connection events
    socket.on('connect', () => {
      // Set player ID from socket immediately
      playerId = socket.id;
      
      // Store socket ID in sessionStorage to maintain identity across page refreshes
      try {
        sessionStorage.setItem('playerId', playerId);
        
        // Also store a timestamp to know when this session started
        sessionStorage.setItem('sessionStartTime', Date.now());
      } catch (e) {
        // Silent catch
      }
      
      // Join default game on connect with reset flag
      socket.emit('joinGame', {
        gameId,
        clientType: 'guest-client',
        skipAuth: true,
        resetState: true // Signal to server to give fresh state
      });
      
      // Show notification that player joined
      showNotification('You joined the game!', 'success');
    });
    
    socket.on('disconnect', () => {
      // Silence disconnect logging
    });
    
    socket.on('connect_error', (error) => {
      // Create fallback game state if none exists
      if (!gameState) {
        createFallbackGameState();
      }
    });

    socket.on('error', (error) => {
      // Create fallback game state if authentication fails
      if (!gameState) {
        createFallbackGameState();
      }
    });
    
    // Game events
    socket.on('gameState', (data) => {
      socketHandlers.gameState(data);
    });
    
    socket.on('gamePositions', (data) => {
      socketHandlers.gamePositions(data);
    });
    
    socket.on('gameUpdates', (data) => {
      socketHandlers.gameUpdates(data);
    });
    
    socket.on('bulletCreated', (data) => {
      socketHandlers.bulletCreated(data);
    });
    
    socket.on('playerGameOver', (data) => {
      socketHandlers.playerGameOver(data);
    });
    
    socket.on('gameWon', (data) => {
      socketHandlers.gameWon(data);
    });
    
    socket.on('gameRestarted', () => {
      socketHandlers.gameRestarted();
    });
    
    socket.on('playerLeft', (playerId) => {
      socketHandlers.playerLeft(playerId);
    });
    
    // Add a specific handler for player joined
    socket.on('playerJoined', (player) => {
      socketHandlers.playerJoined(player);
    });
    
    // Add a handler for player shoot event acknowledgement
    socket.on('bulletAcknowledged', (data) => {
      // Update local bullet with server data if available
      if (gameState && gameState.bullets && data.bulletId) {
        // Server has confirmed the bullet, we can rely on server data
        gameState.bullets[data.bulletId] = data.bullet;
      }
    });
  };
  
  // Create a fallback game state when server authentication fails
  const createFallbackGameState = () => {
    gameWidth = 3000;
    gameHeight = 3000;
    
    gameState = {
      width: gameWidth,
      height: gameHeight,
      players: {},
      asteroids: {},
      bullets: {}
    };
    
    // Add local player if we have a socket ID
    if (socket && socket.id) {
      playerId = socket.id;
      gameState.players[playerId] = {
        id: playerId,
        userId: 'Guest Player',
        x: gameWidth / 2,
        y: gameHeight / 2,
        rotation: 0,
        speed: 0,
        thrust: false,
        lives: 3,
        score: 0,
        isAI: false
      };
      
      // Add some test asteroids so something is visible
      for (let i = 0; i < 20; i++) {
        const id = 'asteroid-' + i;
        const x = Math.random() * gameWidth;
        const y = Math.random() * gameHeight;
        const size = Math.random() < 0.5 ? 'large' : (Math.random() < 0.5 ? 'medium' : 'small');
        const radius = size === 'large' ? 50 : (size === 'medium' ? 30 : 15);
        
        gameState.asteroids[id] = {
          id,
          x,
          y,
          radius,
          rotation: Math.random() * Math.PI * 2,
          size,
          velocityX: (Math.random() - 0.5) * 0.5, // Reduced velocity for slower movement
          velocityY: (Math.random() - 0.5) * 0.5  // Reduced velocity for slower movement
        };
      }
      
      // Add AI players
      for (let i = 0; i < 3; i++) {
        const aiId = 'ai-' + Math.random().toString(36).substring(2, 10);
        const aiX = Math.random() * gameWidth;
        const aiY = Math.random() * gameHeight;
        
        gameState.players[aiId] = {
          id: aiId,
          userId: 'AI ' + (i + 1),
          x: aiX,
          y: aiY,
          rotation: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.5, // Reduced for slower AI
          thrust: Math.random() > 0.5,
          lives: 3,
          score: Math.floor(Math.random() * 100),
          isAI: true
        };
      }
    }
    
    // Start game loop with fallback state
    if (!isGameOver && !isGameWon) {
      lastFrameTime = performance.now();
      clientHasAuthority = true; // Since we're using fallback, client has authority
      requestAnimationFrame(gameLoop);
    }
  };
  
  // Start game
  const startGame = () => {
    // Show the game screen
    showGameScreen();
    
    // Hide other screens
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const gameWonScreen = document.getElementById('game-won-screen');
    
    if (lobbyScreen) lobbyScreen.style.display = 'none';
    if (gameOverScreen) gameOverScreen.style.display = 'none';
    if (gameWonScreen) gameWonScreen.style.display = 'none';
    
    // Reset game state variables
    isGameOver = false;
    isGameWon = false;
    
    // Initialize timing variables
    lastFrameTime = performance.now();
    
    // Set timeout to allow DOM to update before initializing renderer
    setTimeout(() => {
      // Initialize renderer with updated canvas
      Renderer.init();
      
      // Initialize controls
      Controls.init(socket);
      
      // If we don't have a game state already, create a fallback immediately
      if (!gameState) {
        createFallbackGameState();
      }
      
      // Emit join game to get game state from server
      socket.emit('joinGame', {
        gameId,
        clientType: 'guest-client',
        skipAuth: true
      });
      
      // Set a timer to check for game state - if not received within 3 seconds, use fallback
      setTimeout(() => {
        if (!gameState || Object.keys(gameState.asteroids).length === 0) {
          createFallbackGameState();
        }
      }, 3000);
      
      // Only start the game loop if we already have the game state
      if (gameState && playerId) {
        lastFrameTime = performance.now();
        gameLoop(lastFrameTime);
      }
    }, 100);
  };
  
  // Restart game
  const restartGame = () => {
    // Hide game over and game won screens
    gameOverScreen.style.display = 'none';
    gameWonScreen.style.display = 'none';
    
    // Reset game state
    isGameOver = false;
    isGameWon = false;
    
    // Tell server to restart the game
    socket.emit('restartGame', { gameId });
    
    // Show game screen
    gameScreen.style.display = 'block';
    
    // Start game loop
    requestAnimationFrame(gameLoop);
  };
  
  // Return to lobby
  const returnToLobby = () => {
    // Hide game screens
    gameScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    gameWonScreen.style.display = 'none';
    
    // Show lobby screen
    Auth.showLobbyScreen();
  };
  
  // Handle game state update from server
  const handleGameState = (state) => {
    // Update game dimensions if provided
    if (state.width && state.height) {
      gameWidth = state.width;
      gameHeight = state.height;
    } else {
      // Ensure dimensions are defined with defaults
      state.width = gameWidth;
      state.height = gameHeight;
    }
    
    gameState = state;
    
    // Set player ID if not set
    if (!playerId && socket.id) {
      playerId = socket.id;
    }
    
    // Update UI
    updateUI();
  };
  
  // Handle game restarted event
  const handleGameRestarted = (state) => {
    // Update game dimensions if provided
    if (state.width && state.height) {
      gameWidth = state.width;
      gameHeight = state.height;
    } else {
      // Ensure dimensions are defined with defaults
      state.width = gameWidth;
      state.height = gameHeight;
    }
    
    gameState = state;
    
    // Reset game state
    isGameOver = false;
    isGameWon = false;
    
    // Show game screen
    gameScreen.style.display = 'block';
    gameOverScreen.style.display = 'none';
    gameWonScreen.style.display = 'none';
    
    // Update UI
    updateUI();
    
    // Start game loop if not already running
    if (!isGameOver && !isGameWon) {
      requestAnimationFrame(gameLoop);
    }
  };
  
  // Handle game updates from server
  const handleGameUpdates = (updates) => {
    if (!gameState) return;
    
    // Apply updates to game state
    updates.forEach(update => {
      switch (update.type) {
        case 'playerMoved':
          if (gameState.players[update.id]) {
            Object.assign(gameState.players[update.id], update);
          }
          break;
          
        case 'bulletMoved':
          if (gameState.bullets[update.id]) {
            Object.assign(gameState.bullets[update.id], update);
          }
          break;
          
        case 'bulletRemoved':
          delete gameState.bullets[update.id];
          break;
          
        case 'asteroidMoved':
          if (gameState.asteroids[update.id]) {
            Object.assign(gameState.asteroids[update.id], update);
          }
          break;
          
        case 'asteroidDestroyed':
          delete gameState.asteroids[update.id];
          break;
          
        case 'asteroidSplit':
          delete gameState.asteroids[update.id];
          update.newAsteroids.forEach(asteroid => {
            gameState.asteroids[asteroid.id] = asteroid;
          });
          break;
          
        case 'scoreUpdated':
          if (gameState.players[update.playerId]) {
            gameState.players[update.playerId].score = update.score;
            
            // Update UI if this is the current player
            if (update.playerId === playerId) {
              updateUI();
            }
          }
          break;
          
        case 'playerHit':
          if (gameState.players[update.id]) {
            gameState.players[update.id].lives = update.lives;
            
            // Update UI if this is the current player
            if (update.id === playerId) {
              updateUI();
            }
          }
          break;
          
        case 'playerRespawned':
          if (gameState.players[update.id]) {
            Object.assign(gameState.players[update.id], update);
          }
          break;
          
        case 'playerGameOver':
          if (update.id === playerId) {
            handlePlayerGameOver(update);
          }
          break;
          
        case 'levelComplete':
          gameState.asteroids = update.asteroids;
          break;
          
        case 'gameWon':
          handleGameWon(update);
          break;
      }
    });
  };
  
  // Handle player game over
  const handlePlayerGameOver = (data) => {
    if (isGameOver || isGameWon) return;
    
    isGameOver = true;
    
    // Update final score
    finalScoreDisplay.textContent = data.score;
    
    // Show game over screen
    gameScreen.style.display = 'none';
    gameOverScreen.style.display = 'flex';
    
    // Submit score to server
    submitScore(data.score);
    
    // Load game leaderboard
    loadGameLeaderboard();
  };
  
  // Handle game won event
  const handleGameWon = (data) => {
    if (isGameWon) return;
    
    isGameWon = true;
    
    // Update winner info
    winnerNameDisplay.textContent = data.winnerName;
    winnerScoreDisplay.textContent = data.winningScore;
    
    // Show game won screen
    gameScreen.style.display = 'none';
    gameWonScreen.style.display = 'flex';
    
    // Populate player stats table
    const statsBody = document.getElementById('player-stats-body');
    statsBody.innerHTML = '';
    
    // Sort players by score
    const sortedPlayerIds = Object.keys(data.playerStats).sort((a, b) => 
      data.playerStats[b].score - data.playerStats[a].score
    );
    
    sortedPlayerIds.forEach(id => {
      const stats = data.playerStats[id];
      const player = gameState.players[id];
      
      if (!player) return;
      
      const row = document.createElement('tr');
      
      // Highlight the current player and winner
      if (id === playerId) {
        row.classList.add('current-player');
      }
      if (stats.isWinner) {
        row.classList.add('winner');
      }
      
      row.innerHTML = `
        <td>${id === playerId ? 'You' : player.isAI ? 'AI ' + player.userId.substring(3) : player.userId}</td>
        <td>${stats.score}</td>
        <td>${stats.hitsOnAsteroids}</td>
        <td>${stats.hitsOnPlayers}</td>
        <td>${stats.accuracy}%</td>
        <td>${stats.isWinner ? 'Winner!' : 'Lost'}</td>
      `;
      
      statsBody.appendChild(row);
    });
    
    // Submit score to server if this is the current player
    if (data.winnerId === playerId) {
      submitScore(data.winningScore);
    }
  };
  
  // Submit score to server
  const submitScore = async (score) => {
    // Skip score submission for guest users since it will likely fail
    if (playerId && (playerId.startsWith('guest-') || playerId.includes('socket'))) {
      return;
    }
    
    try {
      const response = await fetch('/api/game/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          score,
          skipAuth: true,  // Add a flag to indicate this is a guest score
          clientType: 'guest-client'
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const data = await response.json();
      }
    } catch (err) {
      // Silent catch
    }
  };
  
  // Load game leaderboard
  const loadGameLeaderboard = () => {
    if (!gameState) return;
    
    // Get all players sorted by score
    const players = Object.values(gameState.players)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    // Update leaderboard table
    const leaderboardBody = document.getElementById('game-leaderboard-body');
    leaderboardBody.innerHTML = '';
    
    players.forEach((player, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${player.id === playerId ? 'You' : player.isAI ? 'AI ' + player.userId.substring(3) : player.userId}</td>
        <td>${player.score}</td>
      `;
      leaderboardBody.appendChild(row);
    });
  };
  
  // Update UI
  const updateUI = () => {
    if (!gameState || !playerId || !gameState.players[playerId]) return;
    
    const player = gameState.players[playerId];
    
    // Update score and lives
    scoreDisplay.textContent = player.score;
    livesDisplay.textContent = player.lives;
  };
  
  // Handle game positions update from server
  const handleGamePositions = (data) => {
    if (!gameState) return;
    
    // Update game dimensions if provided
    if (data.width && data.height) {
      gameWidth = data.width;
      gameHeight = data.height;
      
      // Also update in game state for consistency
      gameState.width = gameWidth;
      gameState.height = gameHeight;
    }
    
    lastServerUpdate = Date.now();
    
    // Update player positions with improved interpolation to prevent rubber-banding
    Object.keys(data.players || {}).forEach(id => {
      const serverPlayer = data.players[id];
      let localPlayer = gameState.players[id];
      
      // If player doesn't exist locally, create them
      if (!localPlayer) {
        gameState.players[id] = serverPlayer;
        
        // Notify about a new player
        if (id !== playerId) {
          showNotification(`${serverPlayer.userId || 'A new player'} joined the game!`, 'info');
        }
        return;
      }
      
      // For the local player, use a more client-authoritative approach
      if (id === playerId && clientHasAuthority) {
        // Only adopt server values for score and lives, not position/rotation
        if (serverPlayer.score !== undefined) localPlayer.score = serverPlayer.score;
        if (serverPlayer.lives !== undefined) localPlayer.lives = serverPlayer.lives;
        
        // If server position is drastically different (teleport/respawn), adopt it
        const dx = serverPlayer.x - localPlayer.x;
        const dy = serverPlayer.y - localPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Only snap to server position if extremely far (likely a respawn)
        if (distance > 500) {
          localPlayer.x = serverPlayer.x;
          localPlayer.y = serverPlayer.y;
          localPlayer.rotation = serverPlayer.rotation;
        }
        
        // Update UI since we may have updated score/lives
        updateUI();
      } else {
        // For other players, use stronger interpolation for smoother movement
        const interpolationStrength = localPlayer.isAI ? 0.3 : 0.15;
        
        // Calculate distance between current and server position
        const dx = serverPlayer.x - localPlayer.x;
        const dy = serverPlayer.y - localPlayer.y;
        
        // Interpolate towards server position
        localPlayer.x += dx * interpolationStrength;
        localPlayer.y += dy * interpolationStrength;
        
        // Interpolate rotation (accounting for wrapping)
        let rotDiff = serverPlayer.rotation - localPlayer.rotation;
        if (rotDiff > Math.PI) rotDiff -= 2 * Math.PI;
        if (rotDiff < -Math.PI) rotDiff += 2 * Math.PI;
        localPlayer.rotation += rotDiff * interpolationStrength;
        
        // Update other properties
        if (serverPlayer.speed !== undefined) {
          localPlayer.speed = serverPlayer.speed;
        }
        if (serverPlayer.thrust !== undefined) {
          localPlayer.thrust = serverPlayer.thrust;
        }
        if (serverPlayer.score !== undefined) {
          localPlayer.score = serverPlayer.score;
        }
        if (serverPlayer.lives !== undefined) {
          localPlayer.lives = serverPlayer.lives;
        }
        if (serverPlayer.disconnected !== undefined) {
          localPlayer.disconnected = serverPlayer.disconnected;
        }
      }
    });
    
    // Update bullet positions with improved prediction
    Object.keys(data.bullets || {}).forEach(id => {
      const serverBullet = data.bullets[id];
      let localBullet = gameState.bullets[id];
      
      // If bullet doesn't exist locally, create it
      if (!localBullet) {
        gameState.bullets[id] = serverBullet;
      } else {
        // For existing bullets, use light interpolation
        const dx = serverBullet.x - localBullet.x;
        const dy = serverBullet.y - localBullet.y;
        
        // Only adjust position if bullet is significantly off
        if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
          localBullet.x = serverBullet.x;
          localBullet.y = serverBullet.y;
        }
        
        // Update velocities
        localBullet.velocityX = serverBullet.velocityX;
        localBullet.velocityY = serverBullet.velocityY;
      }
    });
  };
  
  // Handle bullet created event
  const handleBulletCreated = (bullet) => {
    if (!gameState) return;
    
    // Add bullet to game state immediately with reduced velocity
    const slowedBullet = {...bullet};
    slowedBullet.velocityX = bullet.velocityX * 0.5;
    slowedBullet.velocityY = bullet.velocityY * 0.5;
    gameState.bullets[bullet.id] = slowedBullet;
  };
  
  // Handle player shoot action
  const handlePlayerShoot = () => {
    if (!gameState || !playerId || !gameState.players[playerId]) return;
    
    const now = Date.now();
    if (now - lastShootTime < SHOOT_COOLDOWN) return; // Enforce cooldown
    
    lastShootTime = now;
    
    const player = gameState.players[playerId];
    const bulletId = 'bullet-' + playerId + '-' + now;
    
    // Calculate bullet position at the front of the ship
    const adjustedRotation = player.rotation - Math.PI / 2;
    const bulletSpeed = 8; // Fixed bullet speed
    const offsetDistance = 20; // Distance from player center to ship front
    
    // Starting position from the front of the ship
    const bulletX = player.x + Math.cos(adjustedRotation) * offsetDistance;
    const bulletY = player.y + Math.sin(adjustedRotation) * offsetDistance;
    
    // Create a bullet locally for immediate feedback
    const bullet = {
      id: bulletId,
      x: bulletX,
      y: bulletY,
      playerId: playerId,
      velocityX: Math.cos(adjustedRotation) * bulletSpeed,
      velocityY: Math.sin(adjustedRotation) * bulletSpeed,
      createdAt: now
    };
    
    // Add to local game state immediately
    if (!gameState.bullets) gameState.bullets = {};
    gameState.bullets[bulletId] = bullet;
    
    // Send to server
    if (socket && socket.connected) {
      socket.emit('playerShoot', {
        bulletId,
        x: bulletX,
        y: bulletY,
        rotation: player.rotation,
        playerId
      });
    }
    
    // Play sound if available
    if (window.Audio && document.getElementById('laser-sound')) {
      const sound = document.getElementById('laser-sound');
      sound.currentTime = 0;
      sound.play().catch(e => {/* ignore errors */});
    }
  };
  
  // Game loop
  const gameLoop = (timestamp) => {
    // Calculate delta time to maintain consistent speed regardless of frame rate
    const now = timestamp || performance.now();
    deltaTime = now - lastFrameTime;
    
    // Limit frame rate for more consistent gameplay
    if (deltaTime < frameInterval) {
      requestAnimationFrame(gameLoop);
      return;
    }
    
    // Calculate a frame time factor (for normalizing movement across different frame rates)
    const timeScale = Math.min(deltaTime / (1000 / 60), 2.0); // Cap at 2x to prevent huge jumps
    
    lastFrameTime = now - (deltaTime % frameInterval);
    
    // Process any expired notifications
    const currentTime = Date.now();
    activeNotifications = activeNotifications.filter(notification => {
      if (notification.expires <= currentTime) {
        if (notification.element && notification.element.parentNode) {
          notification.element.parentNode.removeChild(notification.element);
        }
        return false;
      }
      return true;
    });
    
    if (gameState) {
      // Ensure game dimensions are set with valid numbers
      if (!gameState.width || isNaN(gameState.width)) gameState.width = 3000;
      if (!gameState.height || isNaN(gameState.height)) gameState.height = 3000;
      
      // Check if player exists and create if needed
      if (playerId && (!gameState.players[playerId] || !gameState.players)) {
        gameState.players = gameState.players || {};
        gameState.players[playerId] = {
          id: playerId,
          userId: 'You',
          x: gameState.width / 2,
          y: gameState.height / 2,
          rotation: 0,
          speed: 0,
          thrust: false,
          lives: 3,
          score: 0,
          isAI: false
        };
      }
      
      // Apply client-side prediction for the local player
      if (playerId && gameState.players[playerId]) {
        const player = gameState.players[playerId];
        
        // Skip update if player is marked as dead
        if (player.dead) {
          requestAnimationFrame(gameLoop);
          return;
        }
        
        // Ensure player has valid position
        if (isNaN(player.x)) player.x = gameState.width / 2;
        if (isNaN(player.y)) player.y = gameState.height / 2;
        if (isNaN(player.rotation)) player.rotation = 0;
        if (isNaN(player.speed)) player.speed = 0;
        
        const controls = Controls.getControlState();
        
        // Update rotation with time scaling and adjusted rotation speed
        if (controls.rotateLeft) {
          player.rotation -= ROTATION_SPEED * timeScale;
        }
        if (controls.rotateRight) {
          player.rotation += ROTATION_SPEED * timeScale;
        }
        
        // Update acceleration with time scaling and adjusted acceleration
        if (controls.thrust) {
          player.speed += ACCELERATION * timeScale;
          if (player.speed > MAX_SPEED) {
            player.speed = MAX_SPEED;
          }
          player.thrust = true;
        } else {
          player.speed *= Math.pow(FRICTION, timeScale); // Apply friction based on time
          player.thrust = false;
        }
        
        // Update position with time scaling
        // Adjust rotation by -PI/2 to match ship's orientation
        const adjustedRotation = player.rotation - Math.PI / 2;
        player.x += Math.cos(adjustedRotation) * player.speed * timeScale;
        player.y += Math.sin(adjustedRotation) * player.speed * timeScale;
        
        // Wrap around screen edges using game dimensions
        if (player.x < 0) player.x = gameState.width;
        if (player.x > gameState.width) player.x = 0;
        if (player.y < 0) player.y = gameState.height;
        if (player.y > gameState.height) player.y = 0;
        
        // Handle shooting
        if (controls.shoot) {
          handlePlayerShoot();
        }
        
        // Send player position to server at regular intervals
        if (currentTime - lastSentUpdateTime > UPDATE_INTERVAL) {
          socket.emit('updatePlayer', {
            x: player.x,
            y: player.y,
            rotation: player.rotation,
            speed: player.speed,
            thrust: player.thrust
          });
          lastSentUpdateTime = currentTime;
        }
      }
      
      // Apply client-side prediction for bullets with improved handling
      Object.values(gameState.bullets || {}).forEach(bullet => {
        // Ensure bullet has valid position and velocity
        if (isNaN(bullet.x)) bullet.x = gameState.width / 2;
        if (isNaN(bullet.y)) bullet.y = gameState.height / 2;
        if (isNaN(bullet.velocityX)) bullet.velocityX = 0;
        if (isNaN(bullet.velocityY)) bullet.velocityY = 0;
        
        // Apply velocity with time scaling
        bullet.x += bullet.velocityX * timeScale;
        bullet.y += bullet.velocityY * timeScale;
        
        // Wrap around screen edges using game dimensions
        if (bullet.x < 0) bullet.x = gameState.width;
        if (bullet.x > gameState.width) bullet.x = 0;
        if (bullet.y < 0) bullet.y = gameState.height;
        if (bullet.y > gameState.height) bullet.y = 0;
        
        // Calculate bullet lifetime and remove old bullets (client-side cleanup)
        const bulletAge = currentTime - (bullet.createdAt || 0);
        if (bulletAge > 4000) { // 4 seconds max bullet lifetime
          delete gameState.bullets[bullet.id];
        }
      });
      
      // Apply client-side prediction for AI players - Fixed AI movement
      Object.values(gameState.players || {}).forEach(player => {
        if (player.isAI && player.id !== playerId) {
          // Ensure AI has valid position
          if (isNaN(player.x)) player.x = gameState.width / 2;
          if (isNaN(player.y)) player.y = gameState.height / 2;
          if (isNaN(player.rotation)) player.rotation = 0;
          if (isNaN(player.speed)) player.speed = 0;
          
          // AI movement behavior - ensure AI is always moving
          // Add random movement change more frequently
          if (Math.random() < 0.03) { // 3% chance each frame to change direction
            player.rotation += (Math.random() - 0.5) * 0.2;
            player.speed = Math.max(1.0, Math.min(MAX_SPEED * 0.7, player.speed + (Math.random() - 0.3) * 0.5));
            player.thrust = Math.random() > 0.3; // 70% chance to be thrusting
          }
          
          // Always apply some minimum speed to ensure movement
          if (player.speed < 0.5) player.speed = 0.5 + Math.random() * 0.5;
          
          // Apply movement for AI with time scaling
          const adjustedRotation = player.rotation - Math.PI / 2;
          player.x += Math.cos(adjustedRotation) * player.speed * timeScale * 0.8; // Slow down AI a bit
          player.y += Math.sin(adjustedRotation) * player.speed * timeScale * 0.8;
          
          // Wrap around screen edges
          if (player.x < 0) player.x = gameState.width;
          if (player.x > gameState.width) player.x = 0;
          if (player.y < 0) player.y = gameState.height;
          if (player.y > gameState.height) player.y = 0;
          
          // Occasionally make AI shoot
          if (Math.random() < 0.005 && socket && socket.connected) { // 0.5% chance each frame
            const bulletId = 'bullet-' + player.id + '-' + currentTime;
            const adjustedRotation = player.rotation - Math.PI / 2;
            const bulletSpeed = 6; // Slightly slower than player bullets
            const offsetDistance = 20;
            
            const bulletX = player.x + Math.cos(adjustedRotation) * offsetDistance;
            const bulletY = player.y + Math.sin(adjustedRotation) * offsetDistance;
            
            // Add AI bullet to game state
            if (!gameState.bullets) gameState.bullets = {};
            gameState.bullets[bulletId] = {
              id: bulletId,
              x: bulletX,
              y: bulletY,
              playerId: player.id,
              velocityX: Math.cos(adjustedRotation) * bulletSpeed,
              velocityY: Math.sin(adjustedRotation) * bulletSpeed,
              createdAt: currentTime
            };
          }
        }
      });
      
      // Apply client-side prediction for asteroids (gentle movement)
      if (gameState.asteroids) {
        Object.values(gameState.asteroids).forEach(asteroid => {
          // Ensure asteroid has valid position and velocity
          if (isNaN(asteroid.x)) asteroid.x = gameState.width / 2;
          if (isNaN(asteroid.y)) asteroid.y = gameState.height / 2;
          if (isNaN(asteroid.velocityX)) asteroid.velocityX = (Math.random() - 0.5) * 0.5;
          if (isNaN(asteroid.velocityY)) asteroid.velocityY = (Math.random() - 0.5) * 0.5;
          
          // Apply movement with time scaling
          asteroid.x += asteroid.velocityX * timeScale;
          asteroid.y += asteroid.velocityY * timeScale;
          
          // Wrap around screen edges
          if (asteroid.x < 0) asteroid.x = gameState.width;
          if (asteroid.x > gameState.width) asteroid.x = 0;
          if (asteroid.y < 0) asteroid.y = gameState.height;
          if (asteroid.y > gameState.height) asteroid.y = 0;
        });
      }
      
      // Simple collision detection implementation (client-side)
      detectCollisions();
      
      // Clean up any disconnected players (remove after 10 seconds of inactivity)
      Object.keys(gameState.players || {}).forEach(id => {
        const player = gameState.players[id];
        if (player.disconnected && player.disconnectTime && Date.now() - player.disconnectTime > 10000) {
          delete gameState.players[id];
        }
      });
      
      Renderer.render(gameState, playerId);
    }
    
    if (!isGameOver && !isGameWon) {
      requestAnimationFrame(gameLoop);
    }
  };
  
  // Add collision detection function
  const detectCollisions = () => {
    if (!gameState || !gameState.players || !gameState.asteroids) return;
    
    // Get current time for respawn timing
    const currentTime = Date.now();
    
    // Check each asteroid against each player
    Object.values(gameState.asteroids).forEach(asteroid => {
      if (!asteroid || !asteroid.radius) return;
      
      Object.values(gameState.players).forEach(player => {
        if (!player || player.dead || player.invulnerable) return;
        
        // Calculate distance between asteroid and player
        const dx = player.x - asteroid.x;
        const dy = player.y - asteroid.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Collision detected (player ship radius is approximately 15)
        const playerRadius = 15;
        if (distance < asteroid.radius + playerRadius) {
          // Handle player hit
          player.lives = player.lives > 0 ? player.lives - 1 : 0;
          
          // If this is the local player, update UI
          if (player.id === playerId) {
            updateUI();
            
            // Show notification
            showNotification('You were hit by an asteroid!', 'warning');
            
            // Game over if no lives left
            if (player.lives <= 0) {
              handlePlayerGameOver({score: player.score || 0});
              return;
            }
          }
          
          // Make player temporarily invulnerable
          player.invulnerable = true;
          player.invulnerableUntil = currentTime + 3000; // 3 seconds of invulnerability
          
          // Reset player position to center if it's the local player
          if (player.id === playerId) {
            player.x = gameState.width / 2;
            player.y = gameState.height / 2;
            player.speed = 0;
            
            // Send respawn info to server
            if (socket && socket.connected) {
              socket.emit('playerRespawned', {
                x: player.x,
                y: player.y,
                lives: player.lives
              });
            }
          }
        }
      });
      
      // Check each asteroid against each bullet
      if (gameState.bullets) {
        Object.entries(gameState.bullets).forEach(([bulletId, bullet]) => {
          if (!bullet) return;
          
          // Calculate distance between asteroid and bullet
          const dx = bullet.x - asteroid.x;
          const dy = bullet.y - asteroid.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Collision detected
          if (distance < asteroid.radius + 5) { // Bullet radius is approximately 5
            // Remove bullet
            delete gameState.bullets[bulletId];
            
            // If this is the local player's bullet, update score locally
            if (bullet.playerId === playerId) {
              // Add score based on asteroid size
              let scoreValue = 0;
              if (asteroid.size === 'large') scoreValue = 20;
              else if (asteroid.size === 'medium') scoreValue = 50;
              else if (asteroid.size === 'small') scoreValue = 100;
              
              // Update player score
              if (gameState.players[playerId]) {
                gameState.players[playerId].score += scoreValue;
                updateUI();
                
                // Show notification
                showNotification(`+${scoreValue} points!`, 'success');
                
                // Send score update to server
                if (socket && socket.connected) {
                  socket.emit('scoreUpdate', {
                    score: gameState.players[playerId].score
                  });
                }
              }
            }
            
            // Tell server about hit (which will handle asteroid destruction/splitting)
            if (socket && socket.connected) {
              socket.emit('asteroidHit', {
                asteroidId: asteroid.id,
                bulletId: bulletId,
                playerId: bullet.playerId
              });
            } else {
              // If offline or server disconnected, handle asteroid locally
              handleAsteroidHit(asteroid, bulletId, bullet.playerId);
            }
          }
        });
      }
    });
    
    // Remove invulnerability status from players when time is up
    Object.values(gameState.players).forEach(player => {
      if (player.invulnerable && player.invulnerableUntil && currentTime > player.invulnerableUntil) {
        player.invulnerable = false;
        delete player.invulnerableUntil;
      }
    });
  };
  
  // Handle asteroid hit locally when server is unavailable
  const handleAsteroidHit = (asteroid, bulletId, playerId) => {
    if (!gameState) return;
    
    // Remove the asteroid from the game state
    if (gameState.asteroids && asteroid.id && gameState.asteroids[asteroid.id]) {
      delete gameState.asteroids[asteroid.id];
    }
    
    // Create smaller asteroids if this wasn't a small asteroid
    if (asteroid.size !== 'small') {
      const newSize = asteroid.size === 'large' ? 'medium' : 'small';
      const newRadius = newSize === 'medium' ? 30 : 15;
      const newSpeed = asteroid.size === 'large' ? 0.7 : 1.0;
      
      // Create 2 smaller asteroids
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const newAsteroidId = 'asteroid-' + Math.random().toString(36).substring(2, 10);
        
        gameState.asteroids[newAsteroidId] = {
          id: newAsteroidId,
          x: asteroid.x,
          y: asteroid.y,
          radius: newRadius,
          size: newSize,
          rotation: Math.random() * Math.PI * 2,
          velocityX: Math.cos(angle) * newSpeed * (Math.random() * 0.5 + 0.5),
          velocityY: Math.sin(angle) * newSpeed * (Math.random() * 0.5 + 0.5)
        };
      }
    }
  };
  
  // Get game state
  const getGameState = () => {
    return gameState;
  };
  
  // Get player ID
  const getPlayerId = () => {
    return playerId;
  };
  
  // Get game dimensions
  const getGameDimensions = () => {
    return { width: gameWidth, height: gameHeight };
  };
  
  // Socket update handlers
  const socketHandlers = {
    gameState: function(newState) {
      // Set game dimensions from server
      if (newState.dimensions) {
        gameWidth = newState.dimensions.width || 3000;
        gameHeight = newState.dimensions.height || 3000;
      } else {
        gameWidth = 3000;
        gameHeight = 3000;
      }
      
      // Ensure all required objects exist in new state
      newState.players = newState.players || {};
      newState.asteroids = newState.asteroids || {};
      newState.bullets = newState.bullets || {};
      
      // Add width and height to game state if not present
      newState.width = gameWidth;
      newState.height = gameHeight;
      
      // Set the game state
      gameState = newState;
      
      // Set player ID if not already set
      if (!playerId && socket && socket.id) {
        playerId = socket.id;
      }
      
      // If player not found for client, add placeholder at center
      if (playerId && !gameState.players[playerId]) {
        gameState.players[playerId] = {
          id: playerId,
          userId: 'You',
          x: gameWidth / 2,
          y: gameHeight / 2,
          rotation: 0,
          speed: 0,
          thrust: false,
          lives: 3,
          score: 0,
          isAI: false
        };
      }
      
      // Start game loop if not already started
      if (!isGameOver && !isGameWon) {
        requestAnimationFrame(gameLoop);
      }
    },
    
    gamePositions: (data) => {
      handleGamePositions(data);
    },
    
    gameUpdates: (data) => {
      // Update game state with new data
      if (!gameState) return;
      
      // Update asteroids
      if (data.asteroids) {
        Object.keys(data.asteroids).forEach(id => {
          gameState.asteroids[id] = data.asteroids[id];
        });
      }
      
      // Update bullets
      if (data.bullets) {
        Object.keys(data.bullets).forEach(id => {
          gameState.bullets[id] = data.bullets[id];
        });
      }
      
      // Update players
      if (data.players) {
        Object.keys(data.players).forEach(id => {
          if (gameState.players[id]) {
            // Update existing player's score and lives
            gameState.players[id].score = data.players[id].score;
            gameState.players[id].lives = data.players[id].lives;
          }
        });
      }
      
      // Update removed entities
      if (data.removed) {
        // Remove bullets
        if (data.removed.bullets) {
          data.removed.bullets.forEach(id => {
            delete gameState.bullets[id];
          });
        }
        
        // Remove asteroids
        if (data.removed.asteroids) {
          data.removed.asteroids.forEach(id => {
            delete gameState.asteroids[id];
          });
        }
        
        // Handle player deaths
        if (data.removed.players) {
          data.removed.players.forEach(id => {
            // Don't remove the player entirely, just mark them as dead
            if (gameState.players[id]) {
              gameState.players[id].dead = true;
            }
          });
        }
      }
      
      // Update frame count
      if (data.frameCount) {
        gameState.frameCount = data.frameCount;
      }
    },
    
    bulletCreated: (bullet) => {
      // Add new bullet to game state
      if (gameState && bullet) {
        gameState.bullets[bullet.id] = bullet;
      }
    },
    
    playerGameOver: (data) => {
      isGameOver = true;
      
      // Show final score
      if (finalScoreDisplay) {
        finalScoreDisplay.textContent = data.score;
      }
      
      // Show game over screen after delay
      setTimeout(() => {
        showScreen('game-over-screen');
      }, 1000);
    },
    
    gameWon: (data) => {
      isGameWon = true;
      
      // Show winner info
      if (winnerNameDisplay && winnerScoreDisplay) {
        winnerNameDisplay.textContent = data.winnerName || 'Player';
        winnerScoreDisplay.textContent = data.winnerScore;
      }
      
      // Show game won screen after delay
      setTimeout(() => {
        showScreen('game-won-screen');
      }, 1000);
    },
    
    gameRestarted: () => {
      // Reset game state
      isGameOver = false;
      isGameWon = false;
      
      // Switch to lobby
      showScreen('lobby-screen');
    },
    
    playerLeft: (id) => {
      // Don't remove player instantly, mark as disconnected and show notification
      if (gameState && gameState.players[id]) {
        // Show notification that player left
        if (id !== playerId) {
          const playerName = gameState.players[id].userId || 'A player';
          showNotification(`${playerName} left the game`, 'warning');
        }
        
        // Mark player as disconnected and set a timestamp
        gameState.players[id].disconnected = true;
        gameState.players[id].disconnectTime = Date.now();
        
        // Fade out the player visually by making them semi-transparent
        gameState.players[id].alpha = 0.5;
      }
    },
    
    playerJoined: function(player) {
      if (!gameState) return;
      
      // Add player to game state
      if (!gameState.players[player.id]) {
        gameState.players[player.id] = player;
        
        // Show notification
        if (player.id !== playerId) {
          showNotification(`${player.userId || 'A new player'} joined the game!`, 'info');
        }
      }
    }
  };
  
  // Helper function to show game screen and hide others
  const showGameScreen = () => {
    if (gameScreen) {
      // First set display to block to make it visible
      gameScreen.style.display = 'block';
      
      // Hide other screens if they exist
      if (document.getElementById('auth-screen')) {
        document.getElementById('auth-screen').style.display = 'none';
      }
      if (document.getElementById('lobby-screen')) {
        document.getElementById('lobby-screen').style.display = 'none';
      }
      if (gameOverScreen) {
        gameOverScreen.style.display = 'none';
      }
      if (gameWonScreen) {
        gameWonScreen.style.display = 'none';
      }
      
      // Force a reflow to ensure the game canvas is properly sized
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        
        // Log canvas state
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
          // Re-initialize the renderer to ensure it has the canvas
          Renderer.init();
          
          // If we already have game state, start rendering
          if (gameState && !isGameOver && !isGameWon) {
            requestAnimationFrame(gameLoop);
          } else if (!gameState) {
            // Create fallback state if we have no state after a short delay
            setTimeout(() => {
              if (!gameState) {
                createFallbackGameState();
              }
            }, 2000);
          }
        }
      }, 50); // small delay to allow the display changes to take effect
    }
  };
  
  // Helper function to show a specific screen and hide others
  const showScreen = (screenId) => {
    // Hide all screens first
    const screens = ['game-screen', 'lobby-screen', 'game-over-screen', 'game-won-screen'];
    screens.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = 'none';
      }
    });
    
    // Show the requested screen
    const screenToShow = document.getElementById(screenId);
    if (screenToShow) {
      // Use flex for game over and game won screens, block for others
      if (screenId === 'game-over-screen' || screenId === 'game-won-screen') {
        screenToShow.style.display = 'flex';
      } else {
        screenToShow.style.display = 'block';
      }
    }
  };
  
  // Show a notification on screen
  const showNotification = (message, type = 'info') => {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `game-notification ${type}`;
    notification.textContent = message;
    
    // Add to DOM
    const notificationsContainer = document.getElementById('game-notifications');
    if (!notificationsContainer) {
      // Create notifications container if it doesn't exist
      const container = document.createElement('div');
      container.id = 'game-notifications';
      container.className = 'notifications-container';
      gameScreen.appendChild(container);
      container.appendChild(notification);
    } else {
      notificationsContainer.appendChild(notification);
    }
    
    // Add to active notifications
    const notificationId = Date.now();
    activeNotifications.push({
      id: notificationId,
      element: notification,
      expires: Date.now() + NOTIFICATION_DURATION
    });
    
    // Auto-remove after duration
    setTimeout(() => {
      removeNotification(notificationId);
    }, NOTIFICATION_DURATION);
    
    return notificationId;
  };
  
  // Remove a notification
  const removeNotification = (id) => {
    const index = activeNotifications.findIndex(n => n.id === id);
    if (index !== -1) {
      const notification = activeNotifications[index];
      if (notification.element && notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
      activeNotifications.splice(index, 1);
    }
  };
  
  // Public API
  return {
    init,
    startGame,
    getGameState,
    getPlayerId,
    getGameDimensions
  };
})();

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Initialize the game module
  Game.init();
  
  // Add CSS for notifications
  const style = document.createElement('style');
  style.textContent = `
    .notifications-container {
      position: fixed;
      top: 10px;
      right: 10px;
      max-width: 300px;
      z-index: 1000;
    }
    .game-notification {
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px 15px;
      margin-bottom: 10px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      animation: notification-slide-in 0.3s ease;
    }
    .game-notification.success {
      border-left: 4px solid #4CAF50;
    }
    .game-notification.warning {
      border-left: 4px solid #FFC107;
    }
    .game-notification.error {
      border-left: 4px solid #F44336;
    }
    .game-notification.info {
      border-left: 4px solid #2196F3;
    }
    @keyframes notification-slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}); 