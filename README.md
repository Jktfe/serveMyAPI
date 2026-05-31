# ServeMyAPI

[![smithery badge](https://smithery.ai/badge/@Jktfe/servemyapi)](https://smithery.ai/server/@Jktfe/servemyapi)

A personal MCP (Model Context Protocol) server for securely storing and accessing API keys across projects using the macOS Keychain.

> **🔒 SECURITY FIRST**: ServeMyAPI is designed to run LOCALLY on your machine. API keys are NEVER transmitted over the internet and should NEVER be deployed to cloud services. **[Read the critical security guidelines](docs/LOCAL-ONLY-SECURITY.md)** before using.

> **Cross-Platform Support**: ServeMyAPI now includes a storage abstraction layer that enables support for multiple platforms:
> - **macOS**: Uses the native Keychain (default)
> - **Windows/Linux**: Uses encrypted file storage
> - **Docker**: Automatically uses encrypted file storage
> - **Memory**: Available for testing and temporary storage

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
- Support for both stdio and HTTP/SSE transports (with authentication)
- Compatible with any MCP client (Claude Desktop, etc.)
- **Enhanced Security Features:**
  - Input validation to prevent path traversal attacks
  - Encrypted file storage for Docker deployments
  - Bearer token authentication for HTTP endpoints
  - Rate limiting and session management
  - Security headers and CORS protection
  - Secure logging with automatic redaction of sensitive data

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

### ⚠️ IMPORTANT SECURITY WARNING

**DO NOT USE THE SMITHERY HOSTED VERSION** for storing real API keys. The Smithery deployment exists for demonstration purposes only. Using it would:

1. **Transmit your API keys over the internet** (even with HTTPS, this violates the principle of keeping keys local)
2. **Store your keys on someone else's server** (the Smithery infrastructure)
3. **Potentially expose your keys** to the service operator or in case of a breach

**ServeMyAPI is designed to run LOCALLY on your machine only.** The entire security model depends on keys never leaving your local environment.

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

## Storage Options

ServeMyAPI automatically selects the best storage provider for your platform:

### Platform Detection
- **macOS**: Keychain (default)
- **Windows**: Encrypted file storage
- **Linux**: Encrypted file storage  
- **Docker**: Encrypted file storage

### Manual Configuration
You can override the automatic detection:

```bash
# Force a specific storage type
export SERVEMYAPI_STORAGE_TYPE=file  # or 'keychain', 'memory'

# Configure file storage location
export STORAGE_DIR=/path/to/secure/directory
```

### Storage Types

1. **Keychain Storage** (macOS only)
   - Native OS-level security
   - No encryption needed
   - Requires user permission on first use

2. **File Storage** (Cross-platform)
   - AES-256-GCM encryption
   - PBKDF2 key derivation
   - Stores in `~/.servemyapi/keys.json.enc` by default
   - Requires `ENCRYPTION_KEY` environment variable

3. **Memory Storage** (Testing)
   - In-memory only
   - Data lost on restart
   - Useful for testing and development

## Security

### Core Security Features

- **Platform-Aware Storage**: Automatically selects secure storage for each platform
- **macOS Keychain Storage**: API keys are stored in the macOS Keychain with native OS-level security
- **Encrypted File Storage**: Cross-platform support with AES-256-GCM encryption
- **Docker Encryption**: When running in Docker, keys are encrypted using AES-256-GCM with PBKDF2 key derivation
- **Authentication**: HTTP/SSE endpoints require Bearer token authentication
- **Input Validation**: Strict validation prevents path traversal and injection attacks
- **Rate Limiting**: Protects against abuse with configurable request limits
- **Secure Logging**: Automatic redaction of sensitive data in all log outputs

### HTTP Server Security

When using the HTTP/SSE transport:

```bash
# Set authentication key
export SERVEAPI_AUTH_KEY="your-secure-api-key"

# Set encryption key for Docker
export ENCRYPTION_KEY="your-encryption-key"

# Configure CORS origins
export ALLOWED_ORIGINS="https://app1.com,https://app2.com"
```

Include the Bearer token in requests:
```
Authorization: Bearer your-secure-api-key
```

### Best Practices

1. **Always use HTTPS in production** - Deploy behind a reverse proxy with TLS
2. **Set strong authentication keys** - Use `openssl rand -base64 32` to generate
3. **Run as non-root** - The Docker image automatically uses a restricted user
4. **Regular key rotation** - Periodically update your authentication and encryption keys
5. **Monitor access logs** - Watch for suspicious patterns or unauthorized attempts

For detailed security configuration, see [docs/SECURITY.md](docs/SECURITY.md).

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