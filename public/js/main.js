/**
 * Main JavaScript file
 * Initializes the game and handles the application lifecycle
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize game
  Game.init();
  
  // Initialize mobile detection
  if (detectMobile()) {
    document.body.classList.add('mobile-device');
    
    // Prevent default touch behavior (scrolling, zooming)
    document.addEventListener('touchmove', function(e) {
      if (e.target.tagName !== 'INPUT') {
        e.preventDefault();
      }
    }, { passive: false });
    
    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
      const now = Date.now();
      if (now - lastTouchEnd < 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  }
  
  // Handle visibility change (tab switching)
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Handle beforeunload event
  window.addEventListener('beforeunload', handleBeforeUnload);
});

// Detect if the device is mobile
function detectMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Handle visibility change
function handleVisibilityChange() {
  if (document.hidden) {
    // Page is hidden (user switched tabs)
    console.log('Game paused - tab inactive');
  } else {
    // Page is visible again
    console.log('Game resumed - tab active');
  }
}

// Handle before unload
function handleBeforeUnload(e) {
  // This will show a confirmation dialog in most browsers
  // when the user tries to close the tab or navigate away
  const confirmationMessage = 'Are you sure you want to leave? Your game progress will be lost.';
  
  e.returnValue = confirmationMessage;
  return confirmationMessage;
} 