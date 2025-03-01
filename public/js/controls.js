/**
 * Controls Module
 * Handles user input for controlling the game
 */
const Controls = (() => {
  // Socket reference
  let socket = null;
  
  // Control state
  const controlState = {
    rotateLeft: false,
    rotateRight: false,
    thrust: false
  };
  
  // Touch controls state
  const touchControls = {
    active: false
  };
  
  // DOM Elements - Note these might not exist if mobile elements aren't in the HTML
  const mobileControls = document.getElementById('mobile-controls');
  const thrustBtn = document.getElementById('thrust-btn');
  const shootBtn = document.getElementById('shoot-btn');
  const rotateLeftBtn = document.getElementById('rotate-left-btn');
  const rotateRightBtn = document.getElementById('rotate-right-btn');
  
  // Debug logging
  console.log("Controls module loaded, mobile controls elements found:", {
    mobileControls: !!mobileControls,
    thrustBtn: !!thrustBtn,
    shootBtn: !!shootBtn,
    rotateLeftBtn: !!rotateLeftBtn,
    rotateRightBtn: !!rotateRightBtn
  });
  
  // Initialize controls
  const init = (socketRef) => {
    console.log("Initializing controls with socket:", !!socketRef);
    
    // Store socket reference
    socket = socketRef;
    
    // Detect if device is mobile
    detectMobile();
    
    // Add keyboard event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Add touch event listeners for mobile
    if (touchControls.active && allMobileElementsExist()) {
      console.log("Initializing touch controls for mobile device");
      initTouchControls();
    } else if (touchControls.active) {
      console.warn("Mobile device detected but mobile control elements are missing in the DOM");
    }
    
    // Start sending movement updates
    startMovementUpdates();
  };
  
  // Check if all mobile control elements exist
  const allMobileElementsExist = () => {
    return mobileControls && thrustBtn && shootBtn && rotateLeftBtn && rotateRightBtn;
  };
  
  // Detect if device is mobile
  const detectMobile = () => {
    touchControls.active = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log("Mobile detection:", touchControls.active);
    
    // Show/hide mobile controls if they exist
    if (mobileControls) {
      mobileControls.style.display = touchControls.active ? 'flex' : 'none';
      console.log(`Set mobile controls display to ${touchControls.active ? 'flex' : 'none'}`);
    } else if (touchControls.active) {
      console.warn("Mobile device detected but mobile controls container is missing");
    }
  };
  
  // Initialize touch controls
  const initTouchControls = () => {
    // Ensure all elements exist before adding listeners
    if (!allMobileElementsExist()) {
      console.error("Cannot initialize touch controls, some elements are missing");
      return;
    }
    
    // Thrust button
    thrustBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      controlState.thrust = true;
    });
    
    thrustBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      controlState.thrust = false;
    });
    
    // Shoot button
    shootBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleShoot();
    });
    
    // Rotate left button
    rotateLeftBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      controlState.rotateLeft = true;
    });
    
    rotateLeftBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      controlState.rotateLeft = false;
    });
    
    // Rotate right button
    rotateRightBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      controlState.rotateRight = true;
    });
    
    rotateRightBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      controlState.rotateRight = false;
    });
  };
  
  // Handle key down events
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        controlState.rotateLeft = true;
        break;
        
      case 'ArrowRight':
      case 'd':
      case 'D':
        controlState.rotateRight = true;
        break;
        
      case 'ArrowUp':
      case 'w':
      case 'W':
        controlState.thrust = true;
        break;
        
      case ' ':
        handleShoot();
        break;
    }
  };
  
  // Handle key up events
  const handleKeyUp = (e) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        controlState.rotateLeft = false;
        break;
        
      case 'ArrowRight':
      case 'd':
      case 'D':
        controlState.rotateRight = false;
        break;
        
      case 'ArrowUp':
      case 'w':
      case 'W':
        controlState.thrust = false;
        break;
    }
  };
  
  // Handle shoot action
  const handleShoot = () => {
    if (socket) {
      socket.emit('playerShoot');
      console.log("Emitting playerShoot event");
    } else {
      console.warn("Cannot shoot, socket is not initialized");
    }
  };
  
  // Start sending movement updates to server
  const startMovementUpdates = () => {
    console.log("Starting movement updates");
    
    // Send movement updates at 60fps to match server
    setInterval(() => {
      if (socket) {
        socket.emit('playerMovement', {
          rotateLeft: controlState.rotateLeft,
          rotateRight: controlState.rotateRight,
          thrust: controlState.thrust
        });
      }
    }, 1000 / 60);
  };
  
  // Public API
  return {
    init,
    getControlState: () => ({ ...controlState })
  };
})(); 