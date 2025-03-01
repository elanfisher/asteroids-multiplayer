// MongoDB initialization script
// This will run when the MongoDB container starts for the first time

// Check if the asteroids database exists, if not create it
db = db.getSiblingDB('asteroids');

// Create collections if they don't exist
db.createCollection('users');
db.createCollection('scores');
db.createCollection('games');

// Create indexes for better performance
db.users.createIndex({ username: 1 }, { unique: true });
db.scores.createIndex({ score: -1 }); // For leaderboard sorting
db.scores.createIndex({ userId: 1 }); // For user-specific queries
db.games.createIndex({ createdAt: -1 }); // For recent games queries

// Add an initial admin user if it doesn't exist
const adminExists = db.users.findOne({ username: 'admin' });
if (!adminExists) {
  // Note: In a real app, this should use a hashed password
  // For this game, the simple hash is sufficient as it's development only
  db.users.insertOne({
    username: 'admin',
    password: '$2b$10$n9L2dCNE/0NFSgJjSNTwUemn1LSJ82cwGVhast8hJUCO0a3wwrQ1q', // 'admin123'
    email: 'admin@example.com',
    isAdmin: true,
    createdAt: new Date()
  });
  print('Created admin user: admin / admin123');
}

// Print status
print('MongoDB initialization complete');
print('Collections created:');
db.getCollectionNames().forEach(function(name) { print('- ' + name); }); 