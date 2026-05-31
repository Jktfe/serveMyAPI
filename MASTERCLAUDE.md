# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
serveMyAPI is a Model Context Protocol (MCP) server that securely stores and manages API keys using the macOS Keychain. It provides a unified interface for AI assistants to access credentials across projects without exposing them in code or configuration files.

## Key Architecture
- **Transport Layers**: Supports both stdio (for Claude Desktop) and HTTP/SSE (for web clients)
- **Storage Backend**: macOS Keychain via `keytar` library, with file-based fallback for Docker
- **Entry Points**: 
  - `src/index.ts` - stdio MCP server
  - `src/server.ts` - HTTP/SSE server
  - `src/cli.ts` - CLI interface
- **Core Service**: `src/services/keychain.ts` handles all storage operations with permission optimization

## Development Commands
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Development mode with hot reload
npm run dev

# Run stdio server (for MCP clients)
npm start

# CLI usage
npm run cli -- list
npm run cli -- get <name>
npm run cli -- store <name> <key>
npm run cli -- delete <name>

# Lint code
npm run lint
```

## Testing
Currently no automated tests are implemented. The test script exits with error code 1.

## MCP Tools Available
1. **store-api-key**: Store an API key with a name identifier
2. **get-api-key**: Retrieve a stored API key by name
3. **delete-api-key**: Remove a stored API key
4. **list-api-keys**: List all stored key names (not values)

## Security Considerations
- Never log or expose API key values in code
- All keys are stored in macOS Keychain (or encrypted file in Docker)
- Permission markers minimize keychain access prompts
- Always validate input parameters before storage operations

## Deployment Notes
- Smithery.yaml configures cloud deployment
- Dockerfile provides containerized environment with file-based storage
- Binary CLI available as `api-key` command when installed globally

## Code Style
- TypeScript with strict mode enabled
- Target ES2022 with NodeNext modules
- Use zod for schema validation
- Follow existing async/await patterns
- Add JSDoc comments for public functions