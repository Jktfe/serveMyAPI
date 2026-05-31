import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { tools } from './tools.js';
import { config } from '../config/index.js';

// Define the extra parameter type based on MCP SDK
interface McpToolExtra {
  signal?: AbortSignal;
}

/**
 * Creates and configures an MCP server instance with all tools
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'ServeMyAPI',
    version: '1.0.0'
  });

  // Register all tools
  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.schema,
      async (params: unknown, _extra: McpToolExtra) => {
        const result = await tool.handler(params);
        // Convert our response format to MCP SDK format
        return {
          content: result.content,
          isError: result.isError
        };
      }
    );
  }

  return server;
}

/**
 * Get server metadata
 */
export function getServerInfo() {
  return {
    name: 'ServeMyAPI',
    version: '1.0.0',
    description: 'Personal MCP server for securely storing and accessing API keys',
    serviceName: config.serviceName,
    tools: tools.map(t => ({
      name: t.name,
      description: t.description
    }))
  };
}