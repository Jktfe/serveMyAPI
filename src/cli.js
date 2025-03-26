#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Create an MCP client that connects to the ServeMyAPI server
// Usage:
//  - list: List all API keys
//  - get <name>: Get a specific API key
//  - set <name> <value>: Set an API key
//  - delete <name>: Delete an API key
async function main() {
  // Start the server process
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const serverPath = path.join(__dirname, 'server.js');
  
  console.log('Starting ServeMyAPI server...');
  
  // We'll let the StdioClientTransport handle the process management
  // No need to spawn the process manually
  
  // Create a transport that connects to the local server process
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath]
  });
  
  // Create a new MCP client with name and version
  const client = new Client("ServeMyAPIClient", "1.0.0");
  
  try {
    // Connect to the server using the transport
    await client.connect(transport);
    console.log('Connected to ServeMyAPI server');
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'list';
    
    let result;
    
    switch(command) {
      case 'list':
        console.log('Listing all API keys...');
        result = await client.callTool({
          name: 'list-api-keys',
          arguments: {}
        });
        break;
      
      case 'get':
        const keyName = args[1];
        if (!keyName) {
          console.error('Error: Key name is required for get command');
          process.exit(1);
        }
        console.log(`Getting API key: ${keyName}`);
        result = await client.callTool({
          name: 'get-api-key',
          arguments: { name: keyName }
        });
        break;
        
      case 'store':
        const setKeyName = args[1];
        const keyValue = args[2];
        if (!setKeyName || !keyValue) {
          console.error('Error: Both key name and value are required for store command');
          process.exit(1);
        }
        console.log(`Setting API key: ${setKeyName}`);
        result = await client.callTool({
          name: 'store-api-key',
          arguments: { name: setKeyName, key: keyValue }
        });
        break;
        
      case 'delete':
        const deleteKeyName = args[1];
        if (!deleteKeyName) {
          console.error('Error: Key name is required for delete command');
          process.exit(1);
        }
        console.log(`Deleting API key: ${deleteKeyName}`);
        result = await client.callTool({
          name: 'delete-api-key',
          arguments: { name: deleteKeyName }
        });
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Available commands: list, get <name>, store <name> <value>, delete <name>');
        process.exit(1);
    }
    
    // Display the results
    // Display the results based on the command
    
    if (result.content && result.content.length > 0) {
      const textContent = result.content.find(item => item.type === 'text');
      
      if (textContent && textContent.text) {
        if (command === 'list') {
          console.log('\nAvailable API Keys:');
          if (textContent.text === 'No API keys found') {
            console.log('No API keys found');
          } else {
            // Split the keys by newline and display them
            const keys = textContent.text.replace('Available API keys:\n', '').split('\n');
            keys.forEach(key => {
              console.log(`- ${key}`);
            });
          }
        } else {
          // For other commands, just display the text content
          console.log(`\nResult: ${textContent.text}`);
        }
      }
    } else {
      console.log('No data returned from the server');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    // Disconnect from the server
    await client.disconnect();
    // Transport will handle closing the server process
  }
}

// Display usage information
function printUsage() {
  console.log(`
ServeMyAPI CLI Usage:
  node cli.js [command] [options]

Commands:
  list                 List all API keys (default)
  get <name>           Get the value of a specific API key
  store <name> <value>   Set the value of an API key
  delete <name>        Delete an API key

Examples:
  node cli.js list
  node cli.js get myApiKey
  node cli.js store myApiKey abc123def456
  node cli.js delete myApiKey
`);
}

// Check if help flag is present
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printUsage();
  process.exit(0);
}

// Run the main function
main();
