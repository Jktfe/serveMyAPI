FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose port (if using HTTP server version)
EXPOSE 3000

# Set the entry command
CMD ["node", "dist/index.js"]

# NOTE: This Dockerfile is for build validation only.
# This application depends on macOS Keychain and will not run properly on non-macOS systems.
# It is intended to be run directly on macOS using 'npm run dev' or 'npm start'.