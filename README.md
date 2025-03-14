# ServeMyAPI

A personal MCP (Model Context Protocol) server for securely storing and accessing API keys across projects using the macOS Keychain.

## Overview

ServeMyAPI allows you to store API keys securely in the macOS Keychain and access them through a consistent MCP interface. This makes it easy to:

- Store API keys securely (they're never visible in .env files or config files)
- Access the same keys across multiple projects
- Use natural language to store and retrieve keys (when used with LLMs like Claude)
- Provide keys directly to your AI assistant when it needs to access services

## Features

- Secure storage of API keys in the macOS Keychain
- Simple MCP tools for storing, retrieving, listing, and deleting keys
- Support for both stdio and HTTP/SSE transports
- Compatible with any MCP client (Claude Desktop, etc.)

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/servemyapi.git
cd servemyapi

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Running as a stdio server

This is the simplest way to use ServeMyAPI, especially when working with Claude Desktop:

```bash
npm start
```

### Running as an HTTP server

For applications that require HTTP access:

```bash
node dist/server.js
```

This will start the server on port 3000 (or the port specified in the PORT environment variable).

### Configuring MCP Clients

ServeMyAPI works with any MCP-compatible client. Example configuration files are provided in the `examples` directory.

#### Claude Desktop

To use ServeMyAPI with Claude Desktop:

1. Locate or create the Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%AppData%\Claude\claude_desktop_config.json`

2. Add ServeMyAPI to the `mcpServers` section (you can copy from `examples/claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "serveMyAPI": {
         "command": "node",
         "args": [
           "/ABSOLUTE/PATH/TO/servemyapi/dist/index.js"
         ]
       }
     }
   }
   ```

3. Replace `/ABSOLUTE/PATH/TO/servemyapi` with the actual path to your ServeMyAPI installation.
4. Restart Claude Desktop.

#### Windsurf

To use ServeMyAPI with Windsurf:

1. Open Windsurf editor and navigate to Settings
2. Add ServeMyAPI to your MCP server configuration using the example in `examples/windsurf_config.json`
3. Adapt the paths to your local installation

## MCP Tools

ServeMyAPI exposes the following tools:

### store-api-key

Store an API key in the keychain.

Parameters:
- `name`: The name/identifier for the API key
- `key`: The API key to store

Example (from Claude):
```
Using serveMyAPI, store my API key ABC123XYZ as "OpenAI API Key"
```

### get-api-key

Retrieve an API key from the keychain.

Parameters:
- `name`: The name/identifier of the API key to retrieve

Example (from Claude):
```
Using serveMyAPI, get the API key named "OpenAI API Key"
```

### delete-api-key

Delete an API key from the keychain.

Parameters:
- `name`: The name/identifier of the API key to delete

Example (from Claude):
```
Using serveMyAPI, delete the API key named "OpenAI API Key"
```

### list-api-keys

List all stored API keys.

No parameters required.

Example (from Claude):
```
Using serveMyAPI, list all my stored API keys
```

## Security Notes

- All API keys are stored securely in the macOS Keychain
- Keys are only accessible to the current user
- The keychain requires authentication for access
- No keys are stored in plaintext or logged anywhere

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Lint the code
npm run lint

# Build for production
npm run build
```

## License

MIT