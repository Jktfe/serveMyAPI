#!/usr/bin/env node

import keychain from './services/keychain.js';

// Get the command line arguments
const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

async function main() {
  try {
    switch (command) {
      case 'list':
        // List all API keys
        const keys = await keychain.listKeys();
        if (keys.length === 0) {
          console.log('No API keys found.');
        } else {
          console.log('Stored API keys:');
          keys.forEach(key => console.log(` - ${key}`));
        }
        break;
        
      case 'get':
        // Get an API key by name
        const keyName = args[1];
        if (!keyName) {
          console.error('Error: Please provide a key name.');
          printUsage();
          process.exit(1);
        }
        
        const value = await keychain.getKey(keyName);
        if (value) {
          console.log(`${keyName}: ${value}`);
        } else {
          console.error(`Error: Key '${keyName}' not found.`);
          process.exit(1);
        }
        break;
        
      case 'store':
      case 'add':
        // Store an API key
        const storeName = args[1];
        const storeValue = args[2];
        
        if (!storeName || !storeValue) {
          console.error('Error: Please provide both a key name and value.');
          printUsage();
          process.exit(1);
        }
        
        await keychain.storeKey(storeName, storeValue);
        console.log(`Key '${storeName}' stored successfully.`);
        break;
        
      case 'delete':
      case 'remove':
        // Delete an API key
        const deleteName = args[1];
        
        if (!deleteName) {
          console.error('Error: Please provide a key name to delete.');
          printUsage();
          process.exit(1);
        }
        
        const deleted = await keychain.deleteKey(deleteName);
        if (deleted) {
          console.log(`Key '${deleteName}' deleted successfully.`);
        } else {
          console.error(`Error: Failed to delete key '${deleteName}'. Key may not exist.`);
          process.exit(1);
        }
        break;
        
      case '--help':
      case '-h':
      case 'help':
        printUsage();
        break;
        
      default:
        console.error(`Error: Unknown command '${command}'.`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
Usage: api-key <command> [options]

Commands:
  list                          List all stored API keys
  get <key-name>                Retrieve the value of an API key
  store <key-name> <key-value>  Store a new API key
  add <key-name> <key-value>    Alias for 'store'
  delete <key-name>             Delete an API key
  remove <key-name>             Alias for 'delete'
  help                          Show this help message

Examples:
  api-key list
  api-key get github_token
  api-key store github_token ghp_123456789abcdefg
  api-key delete github_token
`);
}

main().catch(err => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});