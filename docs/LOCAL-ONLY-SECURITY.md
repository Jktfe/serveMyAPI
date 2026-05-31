# ⚠️ CRITICAL: ServeMyAPI is LOCAL-ONLY Software

## Core Security Principle

**ServeMyAPI must NEVER be deployed to the internet or cloud services. API keys must NEVER leave your local machine.**

## Why Local-Only?

ServeMyAPI is designed to solve the problem of sharing API keys with AI assistants (like Claude) while maintaining security. The ENTIRE security model depends on:

1. **Physical control** of the machine where keys are stored
2. **No network transmission** of actual API keys
3. **Local storage** using OS-level security (Keychain) or encryption

## What This Means

### ✅ CORRECT Usage

- **Local MCP Server**: Running on your personal computer
- **Claude Desktop**: Connecting to local MCP server via stdio
- **CLI Tool**: Managing keys from your terminal
- **Local Development**: HTTP server on localhost only

### ❌ INCORRECT Usage (SECURITY BREACH)

- **Cloud Deployment**: AWS, Heroku, Google Cloud, etc.
- **Smithery Hosting**: Would transmit keys over internet
- **Public HTTP Server**: Exposing port 3000 to internet
- **Shared Servers**: Running on shared/multi-user systems
- **Remote Access**: Accessing over VPN or remote desktop

## The MCP Tool Returns Keys - This is Intentional

When you use the `get-api-key` tool through MCP, it returns the actual key value. This is:
- **Safe**: Because MCP runs locally on your machine
- **Necessary**: So Claude can use the key to make API calls
- **Secure**: The key never leaves your local environment

## HTTP Server - Use with Extreme Caution

The HTTP server exists for specific local use cases but:

1. **NEVER expose to internet** (even with authentication)
2. **NEVER deploy to cloud services**
3. **ONLY use on localhost (127.0.0.1)**

Even with all security features (JWT, HTTPS, rate limiting), exposing the HTTP server would fundamentally break the security model by making keys accessible over a network.

## Storage Security

### macOS (Keychain)
- Keys stored in OS Keychain
- Protected by your user login
- Never visible in files

### Windows/Linux (Encrypted Files)
- AES-256-GCM encryption
- Keys never stored in plaintext
- Located in `~/.servemyapi/keys.json.enc`

### Memory Storage
- For testing only
- Keys lost on restart
- Never use for real keys

## If You Need Remote Access

If you need to access keys from multiple machines:

1. **Don't use ServeMyAPI** for this use case
2. Consider proper secrets management:
   - HashiCorp Vault
   - AWS Secrets Manager
   - Azure Key Vault
   - 1Password Secrets

These are designed for network access with proper authentication, audit trails, and enterprise security.

## Security Checklist

Before using ServeMyAPI, confirm:

- [ ] Running on YOUR personal computer
- [ ] NOT accessible from internet
- [ ] NOT deployed to any cloud service
- [ ] NOT using Smithery hosted version for real keys
- [ ] HTTP server (if used) bound to 127.0.0.1 only
- [ ] Understanding that keys will be returned to LOCAL MCP clients

## The Bottom Line

ServeMyAPI trades network security for local convenience. It's secure because your keys never leave your machine. The moment you try to make it "accessible from anywhere," you've defeated its entire purpose and created a security vulnerability.

**If you need remote access to secrets, ServeMyAPI is not the right tool.**