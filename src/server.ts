import express from 'express';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import keychainService from "./services/keychain.js";

// Create an MCP server
const server = new McpServer({
  name: "ServeMyAPI",
  version: "1.0.0"
});

// Tool to store an API key
server.tool(
  "store-api-key",
  {
    name: z.string().min(1).describe("The name/identifier for the API key"),
    key: z.string().min(1).describe("The API key to store"),
  },
  async ({ name, key }) => {
    try {
      await keychainService.storeKey(name, key);
      return {
        content: [{ 
          type: "text", 
          text: `Successfully stored API key with name: ${name}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error storing API key: ${(error as Error).message}` 
        }],
        isError: true
      };
    }
  }
);

// Tool to retrieve an API key
server.tool(
  "get-api-key",
  {
    name: z.string().min(1).describe("The name/identifier of the API key to retrieve"),
  },
  async ({ name }) => {
    try {
      const key = await keychainService.getKey(name);
      
      if (!key) {
        return {
          content: [{ 
            type: "text", 
            text: `No API key found with name: ${name}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: key
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error retrieving API key: ${(error as Error).message}` 
        }],
        isError: true
      };
    }
  }
);

// Tool to delete an API key
server.tool(
  "delete-api-key",
  {
    name: z.string().min(1).describe("The name/identifier of the API key to delete"),
  },
  async ({ name }) => {
    try {
      const success = await keychainService.deleteKey(name);
      
      if (!success) {
        return {
          content: [{ 
            type: "text", 
            text: `No API key found with name: ${name}` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `Successfully deleted API key with name: ${name}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error deleting API key: ${(error as Error).message}` 
        }],
        isError: true
      };
    }
  }
);

// Tool to list all stored API keys
server.tool(
  "list-api-keys",
  {},
  async () => {
    try {
      const keys = await keychainService.listKeys();
      
      if (keys.length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: "No API keys found" 
          }]
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `Available API keys:\n${keys.join("\n")}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error listing API keys: ${(error as Error).message}` 
        }],
        isError: true
      };
    }
  }
);

// Set up Express app for HTTP transport
const app = express();
const port = process.env.PORT || 3000;

// Store active transports
const activeTransports = new Map<string, any>();

app.get("/sse", async (req, res) => {
  const id = Date.now().toString();
  const transport = new SSEServerTransport("/messages", res);
  
  activeTransports.set(id, transport);
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Handle client disconnect
  req.on('close', () => {
    activeTransports.delete(id);
  });
  
  await server.connect(transport);
});

app.post("/messages", express.json(), (req, res) => {
  // Get the last transport - in a production app, you'd want to maintain sessions
  const lastTransportId = Array.from(activeTransports.keys()).pop();
  
  if (!lastTransportId) {
    res.status(400).json({ error: "No active connections" });
    return;
  }
  
  const transport = activeTransports.get(lastTransportId);
  transport.handlePostMessage(req, res).catch((error: Error) => {
    console.error("Error handling message:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// Simple home page
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>ServeMyAPI</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          p { line-height: 1.6; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>ServeMyAPI</h1>
        <p>This is a personal MCP server for securely storing and accessing API keys across projects using the macOS Keychain.</p>
        <p>The server exposes the following tools:</p>
        <ul>
          <li><strong>store-api-key</strong> - Store an API key in the keychain</li>
          <li><strong>get-api-key</strong> - Retrieve an API key from the keychain</li>
          <li><strong>delete-api-key</strong> - Delete an API key from the keychain</li>
          <li><strong>list-api-keys</strong> - List all stored API keys</li>
        </ul>
        <p>This server is running with HTTP SSE transport. Connect to /sse for the SSE endpoint and post messages to /messages.</p>
      </body>
    </html>
  `);
});

// Start the server
app.listen(port, () => {
  console.log(`ServeMyAPI HTTP server is running on port ${port}`);
});

export { server };