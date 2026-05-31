import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer, getServerInfo } from "./mcp/server.js";
import { corsMiddleware, sseSecurityHeaders } from "./middleware/security.js";
import { errorHandler, notFoundHandler, requestLogger, setupErrorHandlers } from "./middleware/error-handler.js";
import { commonSecurityValidation, schemas, validate } from "./middleware/validation.js";
import { applyCsrfProtection } from "./middleware/csrf.js";
import { jwtAuth } from "./middleware/jwt-auth.js";
import { apiKeyAuth } from "./middleware/api-key-auth.js";
import { apiRateLimiter, authRateLimiter, publicRateLimiter } from "./middleware/rate-limiter.js";
import { secureSessionManager } from './services/secure-session-manager.js';
import { config, isProduction, getAllowedOrigins } from './config/index.js';
import { logger } from './utils/logger.js';
import { authService } from './services/auth.js';

// Set up error handlers
setupErrorHandlers();

// Create MCP server with all tools
const server = createMcpServer();

// Set up Express app for HTTP transport
const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Apply global security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Parse cookies for CSRF protection
app.use(cookieParser());

// Apply request logging
app.use(requestLogger);

// Apply common security validation
app.use(commonSecurityValidation());

// Parse JSON with strict limits
app.use(express.json({ 
  limit: '1mb',
  strict: true,
  type: ['application/json', 'application/csp-report']
}));

// Apply CORS
app.use(corsMiddleware);

// Apply CSRF protection for non-API routes
app.use(applyCsrfProtection(getAllowedOrigins()));

// API Routes with JWT authentication
app.post("/api/auth/refresh", 
  authRateLimiter(),
  validate(schemas.refreshToken), 
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshAccessToken(refreshToken);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// SSE endpoint with API key authentication
app.get("/sse", 
  apiKeyAuth({ permissions: ['read'] }),
  apiRateLimiter(),
  validate(schemas.sseConnect),
  sseSecurityHeaders, 
  async (req, res, next) => {
    try {
      const transport = new SSEServerTransport("/messages", res);
      const session = secureSessionManager.createSession(req, transport);
      
      // Update session with auth info
      if (req.auth) {
        secureSessionManager.updateSessionAuth(
          session.id,
          req.auth.apiKeyId,
          req.auth.permissions
        );
      }
      
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Session-ID', session.id);
      res.setHeader('X-CSRF-Token', session.csrfToken);
      
      // Handle client disconnect
      req.on('close', () => {
        secureSessionManager.removeSession(session.id);
        logger.info('SSE client disconnected', { sessionId: session.id });
      });
      
      await server.connect(transport);
      
      logger.info('SSE client connected', { 
        sessionId: session.id,
        apiKeyId: req.auth?.apiKeyId 
      });
    } catch (error) {
      next(error);
    }
  }
);

// Messages endpoint with API key authentication
app.post("/messages", 
  apiKeyAuth({ permissions: ['write'] }),
  apiRateLimiter(),
  validate(schemas.postMessage),
  async (req, res, next) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        res.status(400).json({ error: "Missing session ID" });
        return;
      }
      
      // Validate session with fingerprint
      const session = secureSessionManager.validateSession(sessionId, req);
      
      // Verify auth matches session
      if (req.auth && session.apiKeyId !== req.auth.apiKeyId) {
        logger.warn('Session API key mismatch', {
          sessionId,
          sessionApiKeyId: session.apiKeyId,
          requestApiKeyId: req.auth.apiKeyId
        });
        res.status(403).json({ error: "Session authentication mismatch" });
        return;
      }
      
      // Handle the message
      await session.transport.handlePostMessage(req, res);
      
      logger.debug('Message processed', { 
        sessionId,
        method: req.body.method 
      });
    } catch (error) {
      next(error);
    }
  }
);

// Health check endpoint (public)
app.get("/health", publicRateLimiter(), (req, res) => {
  const serverInfo = getServerInfo();
  const stats = secureSessionManager.getStats();
  res.json({ 
    status: "healthy",
    version: serverInfo.version,
    uptime: process.uptime(),
    sessions: stats.totalSessions,
    timestamp: new Date().toISOString()
  });
});

// API info endpoint (public)
app.get("/api/info", publicRateLimiter(), (req, res) => {
  const serverInfo = getServerInfo();
  res.json({
    ...serverInfo,
    security: {
      authRequired: true,
      authMethods: ['apiKey', 'jwt'],
      csrfProtection: true,
      rateLimiting: true
    }
  });
});

// API Key Management endpoints (requires JWT auth)
app.post("/api/keys", 
  jwtAuth({ permissions: ['admin'] }),
  apiRateLimiter(),
  validate(schemas.createApiKey),
  async (req, res, next) => {
    try {
      const result = await authService.createApiKey(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

app.delete("/api/keys/:id", 
  jwtAuth({ permissions: ['admin'] }),
  apiRateLimiter(),
  validate(schemas.idParam),
  async (req, res, next) => {
    try {
      await authService.revokeApiKey(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/keys", 
  jwtAuth({ permissions: ['admin'] }),
  apiRateLimiter(),
  async (req, res, next) => {
    try {
      const keys = await authService.listApiKeys();
      res.json(keys);
    } catch (error) {
      next(error);
    }
  }
);

// Simple home page
app.get("/", publicRateLimiter(), (req, res) => {
  const serverInfo = getServerInfo();
  const csrfToken = req.headers['x-csrf-token'] || 'Not available - use /sse endpoint first';
  res.send(`
    <html>
      <head>
        <title>${serverInfo.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          p { line-height: 1.6; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
          .tool { margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 5px; }
          .tool-name { font-weight: bold; color: #0066cc; }
          .security-note { background: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>${serverInfo.name}</h1>
        <p>${serverInfo.description}</p>
        
        <div class="security-note">
          <strong>Security Features:</strong> This server implements JWT authentication, API key scoping, 
          CSRF protection, session fingerprinting, rate limiting, and comprehensive input validation.
        </div>
        
        <h2>Available Tools</h2>
        ${serverInfo.tools.map(tool => `
          <div class="tool">
            <span class="tool-name">${tool.name}</span>
            ${tool.description ? `- ${tool.description}` : ''}
          </div>
        `).join('')}
        
        <h2>Authentication</h2>
        <p>All API endpoints require authentication:</p>
        <pre>Authorization: Bearer &lt;your-api-key&gt;</pre>
        
        <h2>API Endpoints</h2>
        <h3>MCP Endpoints</h3>
        <ul>
          <li><code>GET /sse</code> - SSE connection endpoint (requires 'read' permission)</li>
          <li><code>POST /messages</code> - Send messages to MCP server (requires 'write' permission)</li>
        </ul>
        
        <h3>Authentication Endpoints</h3>
        <ul>
          <li><code>POST /api/auth/refresh</code> - Refresh JWT access token</li>
        </ul>
        
        <h3>API Key Management (Admin only)</h3>
        <ul>
          <li><code>POST /api/keys</code> - Create new API key</li>
          <li><code>GET /api/keys</code> - List all API keys</li>
          <li><code>DELETE /api/keys/:id</code> - Revoke API key</li>
        </ul>
        
        <h3>Public Endpoints</h3>
        <ul>
          <li><code>GET /health</code> - Health check endpoint</li>
          <li><code>GET /api/info</code> - Server information (JSON)</li>
        </ul>
        
        <h2>CSRF Protection</h2>
        <p>For state-changing operations, include the CSRF token:</p>
        <pre>X-CSRF-Token: ${csrfToken}</pre>
      </body>
    </html>
  `);
});

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  secureSessionManager.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  secureSessionManager.stop();
  process.exit(0);
});

// Start the server
const serverInstance = app.listen(config.port, () => {
  logger.info(`ServeMyAPI HTTP server started`, {
    port: config.port,
    environment: config.nodeEnv,
    authEnabled: !!config.authKey || !!config.jwtSecret,
    csrfProtection: true,
    rateLimiting: true
  });
  
  if (isProduction()) {
    if (!config.jwtSecret) {
      logger.error('CRITICAL: No JWT_SECRET set in production!');
      process.exit(1);
    }
    if (!config.encryptionKey) {
      logger.error('CRITICAL: No ENCRYPTION_KEY set in production!');
      process.exit(1);
    }
  }
});

// Handle server errors
serverInstance.on('error', (error) => {
  logger.error('Server error', error);
  process.exit(1);
});

export { server, app };