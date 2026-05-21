FROM node:20-slim

# Set environment variable to indicate Docker environment
ENV DOCKER_ENV=true
ENV STORAGE_DIR=/app/data

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Create data directory for file-based storage
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose port (if using HTTP server version)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Set the entry command
CMD ["node", "dist/index.js"]

# Add a prominent note about this MCP server's intended use
LABEL org.opencontainers.image.description="ServeMyAPI MCP server - Securely store and access API keys. For optimal security, run natively on macOS to use Keychain. Container mode uses file-based storage as a fallback."
LABEL org.opencontainers.image.authors="James King"
LABEL org.opencontainers.image.url="https://github.com/Jktfe/serveMyAPI"