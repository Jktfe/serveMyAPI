FROM node:20-slim AS builder

# Install dependencies for building
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Runtime stage
FROM node:20-slim

# Create non-root user
RUN groupadd -r apiuser && useradd -r -g apiuser apiuser

# Set environment variables
ENV DOCKER_ENV=true
ENV STORAGE_DIR=/app/data
ENV NODE_ENV=production

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create data directory with secure permissions
RUN mkdir -p /app/data && \
    chown -R apiuser:apiuser /app && \
    chmod 700 /app/data

# Install curl for health checks as root
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Switch to non-root user
USER apiuser

# Expose port (if using HTTP server version)
EXPOSE 3000

# Health check with auth header
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Set the entry command
CMD ["node", "dist/index.js"]

# Add a prominent note about this MCP server's intended use
LABEL org.opencontainers.image.description="ServeMyAPI MCP server - Securely store and access API keys. For optimal security, run natively on macOS to use Keychain. Container mode uses file-based storage as a fallback."
LABEL org.opencontainers.image.authors="James King"
LABEL org.opencontainers.image.url="https://github.com/Jktfe/serveMyAPI"