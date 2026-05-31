# Security Configuration Guide

## Overview
This guide covers the security features and best practices for deploying serveMyAPI.

## Authentication

### Setting up API Authentication
The HTTP/SSE server requires Bearer token authentication. Set the authentication key:

```bash
export SERVEAPI_AUTH_KEY="your-secure-api-key-here"
```

Generate a secure key:
```bash
openssl rand -base64 32
```

### Using Authentication
Include the Bearer token in all API requests:
```
Authorization: Bearer your-secure-api-key-here
```

## HTTPS/TLS Configuration

### Using a Reverse Proxy (Recommended)

The recommended approach is to run serveMyAPI behind a reverse proxy like nginx or Caddy that handles TLS termination.

#### Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Caddy Configuration
```
api.yourdomain.com {
    reverse_proxy localhost:3000
}
```

### Direct TLS Support (Alternative)

For direct TLS support, create a wrapper script:

```javascript
// https-server.js
import https from 'https';
import fs from 'fs';
import app from './dist/server.js';

const options = {
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem')
};

https.createServer(options, app).listen(443, () => {
  console.log('HTTPS Server running on port 443');
});
```

## Docker Security

### Environment Variables
When running in Docker, set these required environment variables:

```bash
# Required for encryption
ENCRYPTION_KEY="your-encryption-key-here"

# Required for authentication
SERVEAPI_AUTH_KEY="your-api-key-here"

# Optional: Allowed CORS origins
ALLOWED_ORIGINS="https://app1.com,https://app2.com"
```

### Docker Run Example
```bash
docker run -d \
  --name servemyapi \
  -p 3000:3000 \
  -e ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  -e SERVEAPI_AUTH_KEY="$(openssl rand -base64 32)" \
  -e NODE_ENV=production \
  -v servemyapi-data:/app/data \
  --user apiuser \
  servemyapi:latest
```

### Docker Compose Example
```yaml
version: '3.8'
services:
  servemyapi:
    image: servemyapi:latest
    environment:
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - SERVEAPI_AUTH_KEY=${SERVEAPI_AUTH_KEY}
      - NODE_ENV=production
      - ALLOWED_ORIGINS=https://myapp.com
    volumes:
      - servemyapi-data:/app/data
    ports:
      - "3000:3000"
    user: apiuser
    restart: unless-stopped

volumes:
  servemyapi-data:
```

## Security Features

### 1. Input Validation
- API key names are validated against strict patterns
- Path traversal attempts are blocked
- Maximum length limits enforced

### 2. Encryption at Rest
- Docker file storage uses AES-256-GCM encryption
- Encryption keys derived using PBKDF2
- Each value encrypted with unique salt and IV

### 3. Rate Limiting
- Default: 60 requests per minute per IP
- Headers included: X-RateLimit-Limit, X-RateLimit-Remaining

### 4. Security Headers
- Content Security Policy
- HSTS (Strict-Transport-Security)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection

### 5. Session Management
- Session isolation per client
- Automatic session cleanup (30-minute timeout)
- Session IDs in headers for proper routing

### 6. Secure Logging
- API keys and sensitive data automatically redacted
- Structured JSON logging
- No sensitive values in error messages

## Best Practices

1. **Always use HTTPS in production**
2. **Set strong, unique values for ENCRYPTION_KEY and SERVEAPI_AUTH_KEY**
3. **Run as non-root user (automatic in Docker)**
4. **Use volume mounts for persistent storage**
5. **Regularly rotate API keys**
6. **Monitor logs for suspicious activity**
7. **Keep the application updated**

## Security Checklist

- [ ] HTTPS/TLS configured
- [ ] Strong ENCRYPTION_KEY set
- [ ] Strong SERVEAPI_AUTH_KEY set
- [ ] Running as non-root user
- [ ] Firewall configured to limit access
- [ ] Regular security updates applied
- [ ] Logs monitored for anomalies
- [ ] Backup encryption keys securely
- [ ] API access limited to trusted IPs (if possible)

## Reporting Security Issues

If you discover a security vulnerability, please email security@example.com with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)