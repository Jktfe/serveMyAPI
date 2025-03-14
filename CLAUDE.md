# serveMyAPI Project Guide

## Project Purpose
This project aims to create a personal MCP server for securely storing and accessing API keys across projects using the macOS Keychain.

## Build & Commands
- Setup: `npm install`
- Start server: `npm run dev`
- Test: `npm test`
- Lint: `npm run lint`
- Build: `npm run build`

## Code Style Guidelines
- **Formatting**: Follow TypeScript standard practices with 2-space indentation
- **Imports**: Group imports by type (core, third-party, local)
- **Naming**: Use camelCase for variables/functions, PascalCase for classes/interfaces
- **Error Handling**: Use try/catch blocks for error management
- **Security**: Never log or expose API keys in plaintext
- **Documentation**: Document all public functions with JSDoc comments

## Key Technologies
- TypeScript SDK for Model Context Protocol (MCP)
- macOS Keychain API for secure credential storage
- Express.js for API endpoints (if needed)