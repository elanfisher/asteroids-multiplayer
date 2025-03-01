FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Add build argument for development mode
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Install dependencies for BCrypt compilation
RUN apk --no-cache add python3 make g++

# Install app dependencies
COPY package*.json ./

# Clean npm cache and install dependencies
RUN npm cache clean --force && \
    if [ "$NODE_ENV" = "production" ]; then \
      npm ci; \
    else \
      npm install; \
      npm install -g nodemon; \
    fi

# Bundle app source
COPY . .

# Remove any existing node_modules that might have been mounted
RUN if [ -d "node_modules" ]; then \
      rm -rf node_modules; \
    fi

# Reinstall modules for the container architecture
RUN npm install

# Expose the port the app runs on
EXPOSE 3000

# Start command depends on environment
CMD if [ "$NODE_ENV" = "production" ]; then \
      node server.js; \
    else \
      nodemon server.js; \
    fi 