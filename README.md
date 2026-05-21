# ServeMyAPI

[![smithery badge](https://smithery.ai/badge/@Jktfe/servemyapi)](https://smithery.ai/server/@Jktfe/servemyapi)

A personal MCP (Model Context Protocol) server for securely storing and accessing API keys across projects using the macOS Keychain.

> **IMPORTANT**: ServeMyAPI is a macOS-specific tool that relies on the macOS Keychain for secure storage. It is not compatible with Windows or Linux operating systems. See the security notes section for more details.

## Overview

ServeMyAPI allows you to store API keys securely in the macOS Keychain and access them through a consistent MCP interface. This makes it easy to:

- Store API keys securely (they're never visible in .env files or config files)
- Access the same keys across multiple projects
- Use natural language to store and retrieve keys (when used with LLMs like Claude)
- Provide keys directly to your AI assistant when it needs to access services

## Why ServeMyAPI over .ENV Files?

Using ServeMyAPI instead of traditional .ENV files solves several common problems:

1. **GitHub Security Conflicts**: 
   - .ENV files need to be excluded from Git repositories for security (via .gitignore)
   - This creates a "hidden context" problem where important configuration is invisible to collaborators and LLMs
   - New developers often struggle with setting up the correct environment variables

2. **LLM Integration Challenges**:
   - LLMs like Claude can't directly access your .ENV files due to security constraints
   - When LLMs need API keys to complete tasks, you often need manual workarounds
   - ServeMyAPI lets your AI assistant request keys through natural language

3. **Cross-Project Consistency**:
   - With .ENV files, you typically need to duplicate API keys across multiple projects
   - When keys change, you need to update multiple files
   - ServeMyAPI provides a central storage location accessible from any project

This approach gives you the best of both worlds: secure storage of sensitive credentials without sacrificing visibility and accessibility for your AI tools.

## Features

- Secure storage of API keys in the macOS Keychain
- Simple MCP tools for storing, retrieving, listing, and deleting keys
- Convenient CLI interface for terminal-based key management
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

### CLI Interface

ServeMyAPI comes with a command-line interface for quick key management directly from your terminal:

```bash
# Install the CLI globally
npm run build
npm link

# List all stored API keys
api-key list

# Get a specific API key
api-key get github_token

# Store a new API key
api-key store github_token ghp_123456789abcdefg

# Delete an API key
api-key delete github_token

# Display help
api-key help
```

### Running as a stdio server

This is the simplest way to use ServeMyAPI as an MCP server, especially when working with Claude Desktop:

```bash
npm start
```

### Running as an HTTP server

For applications that require HTTP access:

```bash
node dist/server.js
```

This will start the server on port 3000 (or the port specified in the PORT environment variable).

### Using Smithery

ServeMyAPI is available as a hosted service on [Smithery](https://smithery.ai/server/@Jktfe/servemyapi).

```javascript
import { createTransport } from "@smithery/sdk/transport.js"

const transport = createTransport("https://server.smithery.ai/@Jktfe/servemyapi")

// Create MCP client
import { Client } from "@modelcontextprotocol/sdk/client/index.js"

const client = new Client({
	name: "Test client",
	version: "1.0.0"
})
await client.connect(transport)

// Use the server tools with your LLM application
const tools = await client.listTools()
console.log(`Available tools: ${tools.map(t => t.name).join(", ")}`)
```

For more details, see the [Smithery API documentation](https://smithery.ai/server/@Jktfe/servemyapi/api).

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

## Roadmap

Future plans for ServeMyAPI include:

- **Code Scanner Tool**: A tool that automatically scans your codebase for API endpoints, sensitive URLs, and environment variables, then suggests names to store them in the Keychain. This would allow developers to continue using .ENV files in their regular workflow while ensuring credentials are also available to LLMs and other tools when needed.

- **Cross-Platform Support**: Investigating secure credential storage options for Windows and Linux to make ServeMyAPI more widely accessible.

- **Integration with Popular Frameworks**: Providing easy integration with frameworks like Next.js, Express, and others.

- **UI for Key Management**: A simple web interface for managing your stored API keys directly.

Feel free to suggest additional features or contribute to the roadmap by opening an issue or pull request.

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Use the CLI during development
npm run cli list

# Lint the code
npm run lint

# Build for production
npm run build
```

## License

MIT