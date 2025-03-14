import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("ServeMyAPI MCP server is running...");
}).catch(error => {
  console.error("Error starting ServeMyAPI MCP server:", error);
});