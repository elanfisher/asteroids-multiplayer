# Multiplayer Asteroids Game

A secure multiplayer Asteroids game with AI players, built with Node.js, Express, Socket.IO, and MongoDB.

## Features

- Multiplayer real-time gameplay
- AI opponents
- User authentication
- Game lobbies
- Leaderboards
- Mobile-responsive controls

## Docker Setup

The game is fully containerized and can be run in either development or production mode using Docker.

### Prerequisites

- Docker
- Docker Compose

### Running the Game

To run the game in development mode (with hot reloading):

```bash
./run-docker.sh development
# or
npm run docker:dev
```

To run the game in production mode:

```bash
./run-docker.sh production
# or
npm run docker:prod
```

The game will be available at http://localhost:3000

### Docker Structure

- **Single Docker Compose Configuration**: One docker-compose.yml file handles both development and production modes.
- **MongoDB Container**: Data is persisted in a Docker volume.
- **MongoDB Initialization**: The database is initialized with required collections and indexes.
- **Application Container**: Runs the Node.js application.

## Local Development (without Docker)

If you prefer to run the game locally without Docker:

1. Make sure MongoDB is running locally
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Automated Testing

The project includes an automated testing tool that simulates a player connecting to the game and interacting with it.

### Running the Tests

To run the automated tests headlessly:

```bash
npm test
```

To run the tests with a visible browser window (useful for debugging):

```bash
npm run test:visible
```

### Test Features

- Connects to the game via a browser
- Logs in as a guest
- Joins a game
- Performs random player actions (thrust, rotate, shoot)
- Monitors game state and player positions
- Detects common rendering issues
- Captures a screenshot
- Provides a detailed report of the testing session

## Environment Variables

The game can be configured using various environment variables, defined in `.env` or passed to Docker:

- `NODE_ENV`: Set to "development" or "production"
- `PORT`: The port to run the server on (default: 3000)
- `MONGODB_URI`: MongoDB connection string
- `SESSION_SECRET`: Secret for session cookies
- `DEBUG`: Debugging output control (default: "asteroids:*")

## Project Structure

- `server.js`: Main application entry point
- `game/`: Game logic modules
- `public/`: Frontend assets and JavaScript
- `models/`: Mongoose data models
- `routes/`: Express routes
- `mongo-init/`: MongoDB initialization scripts

## Troubleshooting

If you encounter issues:

1. Check the logs with `docker compose logs app`
2. Verify MongoDB is running with `docker compose logs mongo`
3. Restart the containers with `docker compose restart`
4. Run the automated test to check for rendering issues 