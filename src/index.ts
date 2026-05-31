import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp/server.js";

// Create MCP server with all tools
const server = createMcpServer();

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("ServeMyAPI MCP server is running...");
}).catch((error: unknown) => {
  console.error("Error starting ServeMyAPI MCP server:", error);
});