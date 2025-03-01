/**
 * Authentication Module
 * Handles user authentication, registration, and session management
 */
const Auth = (() => {
  // DOM Elements
  const authScreen = document.getElementById('auth-screen');
  const lobbyScreen = document.getElementById('lobby-screen');
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  const guestLoginBtn = document.getElementById('guest-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const usernameDisplay = document.getElementById('username-display');
  
  // Current user state
  let currentUser = null;
  
  // Initialize auth module
  const init = () => {
    // Add event listeners
    loginTab.addEventListener('click', showLoginForm);
    registerTab.addEventListener('click', showRegisterForm);
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    guestLoginBtn.addEventListener('click', handleGuestLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    // Check if user is already logged in
    checkAuthStatus();
  };
  
  // Show login form
  const showLoginForm = () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  };
  
  // Show register form
  const showRegisterForm = () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
  };
  
  // Handle login form submission
  const handleLogin = async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      // Set current user
      currentUser = data.user;
      
      // Show lobby screen
      showLobbyScreen();
      
      // Clear form
      loginForm.reset();
      loginError.textContent = '';
    } catch (err) {
      loginError.textContent = err.message;
    }
  };
  
  // Handle register form submission
  const handleRegister = async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    // Check if passwords match
    if (password !== confirmPassword) {
      registerError.textContent = 'Passwords do not match';
      return;
    }
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      // Set current user
      currentUser = data.user;
      
      // Show lobby screen
      showLobbyScreen();
      
      // Clear form
      registerForm.reset();
      registerError.textContent = '';
    } catch (err) {
      registerError.textContent = err.message;
    }
  };
  
  // Handle guest login
  const handleGuestLogin = async () => {
    try {
      console.log("Attempting guest login...");
      
      const response = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error("Failed to parse response as JSON:", e);
        data = { error: "Invalid server response" };
      }
      
      if (!response.ok) {
        console.error("Guest login failed with status:", response.status, data);
        throw new Error(data.error || 'Guest login failed');
      }
      
      console.log("Guest login successful:", data);
      
      // Set current user
      currentUser = data.user;
      
      // Show lobby screen
      showLobbyScreen();
      
      return data;
    } catch (err) {
      console.error('Guest login error:', err);
      if (loginError) {
        loginError.textContent = err.message;
      }
      throw err;
    }
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Logout failed');
      }
      
      // Clear current user
      currentUser = null;
      
      // Show auth screen
      showAuthScreen();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };
  
  // Check if user is already logged in
  const checkAuthStatus = async () => {
    try {
      console.log("Checking authentication status...");
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        currentUser = data.user;
        console.log("User is authenticated:", currentUser.username);
        showLobbyScreen();
      } else {
        console.log("User is not authenticated, falling back to guest login");
        // Automatically try guest login instead of showing auth screen
        handleGuestLogin().catch(err => {
          console.error("Guest login failed:", err);
          showAuthScreen();
        });
      }
    } catch (err) {
      console.error('Auth check error:', err);
      // Try guest login on error as well
      handleGuestLogin().catch(err => {
        console.error("Guest login fallback failed:", err);
        showAuthScreen();
      });
    }
  };
  
  // Show auth screen
  const showAuthScreen = () => {
    authScreen.style.display = 'flex';
    lobbyScreen.style.display = 'none';
    
    // Reset forms
    loginForm.reset();
    registerForm.reset();
    loginError.textContent = '';
    registerError.textContent = '';
    
    // Show login form by default
    showLoginForm();
  };
  
  // Show lobby screen
  const showLobbyScreen = () => {
    authScreen.style.display = 'none';
    lobbyScreen.style.display = 'flex';
    
    // Update username display
    if (currentUser) {
      usernameDisplay.textContent = currentUser.username;
    }
    
    // Load high scores
    loadHighScores();
  };
  
  // Load high scores
  const loadHighScores = async () => {
    try {
      const response = await fetch('/api/game/scores?limit=10', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load high scores');
      }
      
      const data = await response.json();
      
      // Update high scores table
      const highScoresBody = document.getElementById('high-scores-body');
      highScoresBody.innerHTML = '';
      
      if (data.scores.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" style="text-align: center;">No scores yet</td>';
        highScoresBody.appendChild(row);
      } else {
        data.scores.forEach((score, index) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${index + 1}</td>
            <td>${score.user ? score.user.username : 'Unknown'}</td>
            <td>${score.score}</td>
            <td>${new Date(score.date).toLocaleDateString()}</td>
          `;
          highScoresBody.appendChild(row);
        });
      }
    } catch (err) {
      console.error('Load high scores error:', err);
    }
  };
  
  // Get current user
  const getCurrentUser = () => {
    return currentUser;
  };
  
  // Public API
  return {
    init,
    getCurrentUser,
    showAuthScreen,
    showLobbyScreen
  };
})();

// Initialize auth module when DOM is loaded
document.addEventListener('DOMContentLoaded', Auth.init); 