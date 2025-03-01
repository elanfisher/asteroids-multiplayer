#!/bin/bash

# Set default mode to development if not specified
MODE=${1:-development}
export NODE_ENV=$MODE

# Print header
echo "========================================="
echo "  Running Asteroids in $MODE mode"
echo "========================================="

# Stop any running containers
echo "Stopping any running containers..."
docker compose down

# Build and start the containers
echo "Building and starting containers in $MODE mode..."
docker compose up --build -d

# Show logs
echo "Showing logs (press Ctrl+C to exit logs, containers will continue running)..."
docker compose logs -f app

# Instructions for when user exits logs
echo ""
echo "Containers are still running in the background."
echo "To stop containers: docker compose down"
echo "To view logs again: docker compose logs -f app"
echo "To access the game: http://localhost:3000" 