/**
 * Renderer Module
 * Handles rendering the game on the canvas
 */
const Renderer = (() => {
  // Canvas and context
  let canvas = null;
  let ctx = null;
  
  // Current game state reference
  let currentGameState = null;
  
  // Camera/view settings
  let scale = 1;
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  
  // Assets
  const assets = {
    ship: {
      player: null,
      ai: null
    },
    asteroids: {
      large: null,
      medium: null,
      small: null
    }
  };
  
  // Colors
  const colors = {
    background: '#0a0e17',
    player: '#4fc3f7',
    ai: '#f44336',
    bullet: '#ffffff',
    asteroid: '#aaaaaa',
    text: '#ffffff'
  };
  
  // Initialize renderer
  const init = () => {
    console.log("Initializing renderer...");
    
    // Get canvas and context
    canvas = document.getElementById('game-canvas');
    
    if (!canvas) {
      console.error("Cannot find game canvas element! Will retry in 100ms");
      // Retry after a short delay to allow DOM to fully load
      setTimeout(() => {
        canvas = document.getElementById('game-canvas');
        if (canvas) {
          console.log("Canvas found on retry, continuing initialization");
          initializeAfterCanvasFound();
        } else {
          console.error("Canvas still not found after retry");
        }
      }, 100);
      return;
    }
    
    initializeAfterCanvasFound();
  };
  
  // Continue initialization after canvas is found
  const initializeAfterCanvasFound = () => {
    console.log("Canvas element found, dimensions:", {
      offsetWidth: canvas.offsetWidth,
      offsetHeight: canvas.offsetHeight,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      display: window.getComputedStyle(canvas).display
    });
    
    ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error("Failed to get 2D context from canvas!");
      return;
    }
    
    console.log("Canvas 2D context created successfully");
    
    // Set canvas size
    resizeCanvas();
    
    // Handle window resize
    window.addEventListener('resize', resizeCanvas);
    
    // Create assets
    createAssets();
    
    console.log("Renderer initialization complete");
  };
  
  // Resize canvas to fit window
  const resizeCanvas = () => {
    console.log("Resizing canvas to fit window");
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    canvas.width = viewportWidth;
    canvas.height = viewportHeight;
    console.log(`Canvas resized to ${viewportWidth}x${viewportHeight}`);
  };
  
  // Create game assets
  const createAssets = () => {
    // Create ship assets
    assets.ship.player = createShipAsset(colors.player);
    assets.ship.ai = createShipAsset(colors.ai);
    
    // Create asteroid assets
    assets.asteroids.large = createAsteroidAsset(50);
    assets.asteroids.medium = createAsteroidAsset(30);
    assets.asteroids.small = createAsteroidAsset(15);
  };
  
  // Create ship asset
  const createShipAsset = (color) => {
    const shipCanvas = document.createElement('canvas');
    const shipCtx = shipCanvas.getContext('2d');
    
    // Set ship size
    shipCanvas.width = 40;
    shipCanvas.height = 40;
    
    // Draw ship
    shipCtx.fillStyle = color;
    shipCtx.strokeStyle = '#ffffff';
    shipCtx.lineWidth = 1;
    
    shipCtx.beginPath();
    shipCtx.moveTo(20, 0);
    shipCtx.lineTo(5, 40);
    shipCtx.lineTo(20, 30);
    shipCtx.lineTo(35, 40);
    shipCtx.closePath();
    
    shipCtx.fill();
    shipCtx.stroke();
    
    return shipCanvas;
  };
  
  // Create asteroid asset
  const createAsteroidAsset = (radius) => {
    const asteroidCanvas = document.createElement('canvas');
    const asteroidCtx = asteroidCanvas.getContext('2d');
    
    // Set asteroid size
    const size = radius * 2 + 4; // Add padding
    asteroidCanvas.width = size;
    asteroidCanvas.height = size;
    
    // Draw asteroid
    asteroidCtx.fillStyle = colors.asteroid;
    asteroidCtx.strokeStyle = '#ffffff';
    asteroidCtx.lineWidth = 1;
    
    asteroidCtx.beginPath();
    
    // Create irregular polygon
    const numPoints = 8 + Math.floor(Math.random() * 5);
    const center = size / 2;
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const distance = radius * (0.8 + Math.random() * 0.4);
      const x = center + Math.cos(angle) * distance;
      const y = center + Math.sin(angle) * distance;
      
      if (i === 0) {
        asteroidCtx.moveTo(x, y);
      } else {
        asteroidCtx.lineTo(x, y);
      }
    }
    
    asteroidCtx.closePath();
    asteroidCtx.fill();
    asteroidCtx.stroke();
    
    return asteroidCanvas;
  };
  
  // Render game
  const render = (gameState, playerId) => {
    // Check if canvas exists and is visible
    if (!canvas) {
      console.error("Cannot render: canvas element not found");
      // Try to get the canvas again in case it was added to the DOM after init
      canvas = document.getElementById('game-canvas');
      if (canvas) {
        console.log("Canvas found during render call, initializing...");
        initializeAfterCanvasFound();
      }
      return;
    }

    // Check if context exists
    if (!ctx) {
      console.error("Cannot render: canvas context not found");
      // Try to get the context again
      ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
    }
    
    // Check if game state exists
    if (!gameState) {
      console.error("Cannot render: game state is missing");
      return;
    }
    
    // Detailed logging of what's missing if we still have issues
    if (Math.random() < 0.1) { // 10% chance to log
      console.log("Render conditions:", {
        hasCanvas: !!canvas,
        canvasVisible: canvas ? window.getComputedStyle(canvas).display !== 'none' : false,
        hasContext: !!ctx,
        hasGameState: !!gameState,
        gameStatePlayers: gameState ? Object.keys(gameState.players || {}).length : 0,
        playerId: playerId
      });
    }
    
    // Log entire game state occasionally
    if (Math.random() < 0.01) {
      console.log("Full game state:", {
        width: gameState.width,
        height: gameState.height,
        playerCount: Object.keys(gameState.players || {}).length,
        asteroidCount: Object.keys(gameState.asteroids || {}).length,
        bulletCount: Object.keys(gameState.bullets || {}).length,
        playerId: playerId,
        hasCurrentPlayer: !!gameState.players[playerId]
      });
    }
    
    // Store current game state for use in other functions
    currentGameState = gameState;
    
    // Use game dimensions from game state or default to 1200x800
    const gameWidth = gameState.width || 1200;
    const gameHeight = gameState.height || 800;
    
    // Clear canvas
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Get current player
    const currentPlayer = gameState.players[playerId];
    
    // Calculate camera offset (center on player)
    let cameraX = 0;
    let cameraY = 0;
    
    if (currentPlayer) {
      // Center the camera on the player
      cameraX = Math.round(canvas.width / 2 - currentPlayer.x);
      cameraY = Math.round(canvas.height / 2 - currentPlayer.y);
      
      // Debug logging - increase frequency for better visibility
      if (Math.random() < 0.05) {
        console.log(`Player position: (${currentPlayer.x.toFixed(2)}, ${currentPlayer.y.toFixed(2)})`);
        console.log(`Camera offset: (${cameraX}, ${cameraY})`);
        console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
        console.log(`Game dimensions: ${gameWidth}x${gameHeight}`);
      }
    } else {
      // If no current player, center the game area in the canvas
      cameraX = Math.round((canvas.width - gameWidth) / 2);
      cameraY = Math.round((canvas.height - gameHeight) / 2);
      console.log("No player found, centering camera on game area");
    }
    
    // Draw game world boundary for debugging (make it more visible)
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(cameraX, cameraY, gameWidth, gameHeight);
    ctx.lineWidth = 1;
    
    // Draw coordinate axes for debugging
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.5)';
    ctx.moveTo(cameraX, cameraY + gameHeight / 2);
    ctx.lineTo(cameraX + gameWidth, cameraY + gameHeight / 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(50, 255, 50, 0.5)';
    ctx.moveTo(cameraX + gameWidth / 2, cameraY);
    ctx.lineTo(cameraX + gameWidth / 2, cameraY + gameHeight);
    ctx.stroke();
    
    // Render asteroids
    renderAsteroids(gameState.asteroids, cameraX, cameraY);
    
    // Render bullets
    renderBullets(gameState.bullets, cameraX, cameraY);
    
    // Render players
    renderPlayers(gameState.players, playerId, cameraX, cameraY);
    
    // Debug text
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Game Dimensions: ${gameWidth}x${gameHeight}`, 10, 30);
    if (currentPlayer) {
      ctx.fillText(`Player Position: (${currentPlayer.x.toFixed(0)}, ${currentPlayer.y.toFixed(0)})`, 10, 50);
      ctx.fillText(`Camera Offset: (${cameraX.toFixed(0)}, ${cameraY.toFixed(0)})`, 10, 70);
    } else {
      ctx.fillText(`No player found with ID: ${playerId}`, 10, 50);
    }
    
    // Display counts
    ctx.fillText(`Players: ${Object.keys(gameState.players || {}).length}`, 10, 90);
    ctx.fillText(`Asteroids: ${Object.keys(gameState.asteroids || {}).length}`, 10, 110);
    ctx.fillText(`Bullets: ${Object.keys(gameState.bullets || {}).length}`, 10, 130);
  };
  
  // Render asteroids
  const renderAsteroids = (asteroids, cameraX, cameraY) => {
    if (!asteroids) return;
    
    Object.values(asteroids).forEach(asteroid => {
      // Get position with camera offset
      const x = asteroid.x + cameraX;
      const y = asteroid.y + cameraY;
      
      // Size to asset mapping
      let assetKey = 'large';
      if (asteroid.size === 'medium') assetKey = 'medium';
      if (asteroid.size === 'small') assetKey = 'small';
      
      // Draw asteroid
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(asteroid.rotation);
      ctx.drawImage(
        assets.asteroids[assetKey],
        -asteroid.radius,
        -asteroid.radius,
        asteroid.radius * 2,
        asteroid.radius * 2
      );
      ctx.restore();
      
      // Render asteroid wraparound if needed
      renderWraparound(asteroid, assets.asteroids[assetKey], cameraX, cameraY);
    });
  };
  
  // Render bullets
  const renderBullets = (bullets, cameraX, cameraY) => {
    ctx.fillStyle = colors.bullet;
    
    Object.values(bullets).forEach(bullet => {
      // Calculate position with camera offset
      const x = bullet.x + cameraX;
      const y = bullet.y + cameraY;
      
      // Draw bullet
      ctx.beginPath();
      ctx.arc(x, y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Render bullet wraparound if needed
      renderWraparound(bullet, null, cameraX, cameraY);
    });
  };
  
  // Render players
  const renderPlayers = (players, currentPlayerId, cameraX, cameraY) => {
    if (!players) {
      console.warn("No players object provided to renderPlayers");
      return;
    }
    
    // Log less frequently to avoid console flood
    if (Math.random() < 0.01) {
      console.log(`Rendering ${Object.keys(players).length} players with camera offset (${cameraX}, ${cameraY})`);
    }
    
    Object.values(players).forEach(player => {
      // Skip if player is not active
      if (player.lives <= 0) return;
      
      // Get ship asset
      const shipAsset = player.isAI ? assets.ship.ai : assets.ship.player;
      if (!shipAsset) {
        console.error(`Ship asset missing for player ${player.id}`);
        return;
      }
      
      // Calculate position with camera offset
      const x = player.x + cameraX;
      const y = player.y + cameraY;
      
      // Log player position occasionally
      if (Math.random() < 0.005) {
        console.log(`Rendering player at game position (${player.x.toFixed(2)}, ${player.y.toFixed(2)}), screen position (${x.toFixed(2)}, ${y.toFixed(2)})`);
      }
      
      // Save context
      ctx.save();
      
      // Translate to player position
      ctx.translate(x, y);
      
      // Rotate ship
      ctx.rotate(player.rotation);
      
      // Draw ship
      ctx.drawImage(
        shipAsset,
        -shipAsset.width / 2,
        -shipAsset.height / 2,
        shipAsset.width,
        shipAsset.height
      );
      
      // Draw thrust if player is thrusting
      if (player.thrust) {
        ctx.beginPath();
        ctx.moveTo(-10, 15);
        ctx.lineTo(0, 30);
        ctx.lineTo(10, 15);
        ctx.closePath();
        ctx.fillStyle = '#ff9800';
        ctx.fill();
      }
      
      // Draw invulnerability indicator
      if (player.invulnerable) {
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.strokeStyle = player.isAI ? colors.ai : colors.player;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // Restore context
      ctx.restore();
      
      // Render player wraparound if needed
      renderWraparound(player, shipAsset, cameraX, cameraY);
      
      // Render player name
      ctx.fillStyle = player.id === currentPlayerId ? colors.player : player.isAI ? colors.ai : '#ffffff';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        player.id === currentPlayerId ? 'You' : player.isAI ? 'AI' : player.userId,
        x,
        y - 40
      );
    });
  };
  
  // Render object wraparound
  const renderWraparound = (obj, asset, cameraX, cameraY) => {
    if (!obj || !currentGameState) return;
    
    // Use game dimensions from game state or default to 1200x800
    const gameWidth = currentGameState.width || 1200;
    const gameHeight = currentGameState.height || 800;
    const radius = obj.radius || 20;
    
    // Check if object is near the edge of the game area
    const nearLeft = obj.x < radius;
    const nearRight = obj.x > gameWidth - radius;
    const nearTop = obj.y < radius;
    const nearBottom = obj.y > gameHeight - radius;
    
    // Render wraparound copies if needed
    if (nearLeft) {
      renderWraparoundCopy(obj, asset, cameraX + gameWidth, cameraY);
    }
    if (nearRight) {
      renderWraparoundCopy(obj, asset, cameraX - gameWidth, cameraY);
    }
    if (nearTop) {
      renderWraparoundCopy(obj, asset, cameraX, cameraY + gameHeight);
    }
    if (nearBottom) {
      renderWraparoundCopy(obj, asset, cameraX, cameraY - gameHeight);
    }
    
    // Render corner wraparound copies
    if (nearLeft && nearTop) {
      renderWraparoundCopy(obj, asset, cameraX + gameWidth, cameraY + gameHeight);
    }
    if (nearLeft && nearBottom) {
      renderWraparoundCopy(obj, asset, cameraX + gameWidth, cameraY - gameHeight);
    }
    if (nearRight && nearTop) {
      renderWraparoundCopy(obj, asset, cameraX - gameWidth, cameraY + gameHeight);
    }
    if (nearRight && nearBottom) {
      renderWraparoundCopy(obj, asset, cameraX - gameWidth, cameraY - gameHeight);
    }
  };
  
  // Render wraparound copy
  const renderWraparoundCopy = (obj, asset, offsetX, offsetY) => {
    if (!obj) return;
    
    // Handle different object types
    if (obj.type === 'bullet') {
      // Bullets are simple circles
      ctx.beginPath();
      ctx.arc(obj.x + offsetX, obj.y + offsetY, obj.radius || 2, 0, Math.PI * 2);
      ctx.fillStyle = colors.bullet;
      ctx.fill();
    } else if (obj.radius) {
      // Asteroids and players have rotation and are drawn from assets
      ctx.save();
      ctx.translate(obj.x + offsetX, obj.y + offsetY);
      ctx.rotate(obj.rotation || 0);
      
      // Determine if this is a player or asteroid by checking for 'isAI' property
      if (obj.isAI !== undefined) {
        // It's a player
        const shipAsset = obj.isAI ? assets.ship.ai : assets.ship.player;
        if (!shipAsset) {
          console.error("Ship asset is missing");
          ctx.restore();
          return;
        }
        
        // Use actual dimensions from the asset
        const shipWidth = shipAsset.width;
        const shipHeight = shipAsset.height;
        
        ctx.drawImage(
          shipAsset,
          -shipWidth / 2,
          -shipHeight / 2,
          shipWidth,
          shipHeight
        );
        
        // Draw thrust if active
        if (obj.thrust) {
          ctx.beginPath();
          ctx.moveTo(-10, 15);
          ctx.lineTo(0, 30 + Math.random() * 10);
          ctx.lineTo(10, 15);
          ctx.fillStyle = '#ff9900';
          ctx.fill();
        }
      } else if (asset) {
        // It's an asteroid
        ctx.drawImage(
          asset,
          -obj.radius,
          -obj.radius,
          obj.radius * 2,
          obj.radius * 2
        );
      }
      
      ctx.restore();
    }
  };
  
  // Public API
  return {
    init,
    render
  };
})(); 