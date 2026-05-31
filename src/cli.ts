#!/usr/bin/env node

import keychain from './services/keychain.js';
import { isServeMyAPIError } from './errors/index.js';

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
          // eslint-disable-next-line no-console
          console.log('No API keys found.');
        } else {
          // eslint-disable-next-line no-console
          console.log('Stored API keys:');
          // eslint-disable-next-line no-console
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
          // NEVER print the actual key value for security
          // eslint-disable-next-line no-console
          console.log(`Key '${keyName}' exists in keychain.`);
          // eslint-disable-next-line no-console
          console.log(`[Key value hidden for security - access it through the MCP server]`);
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
        // eslint-disable-next-line no-console
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
          // eslint-disable-next-line no-console
          console.log(`Key '${deleteName}' deleted successfully.`);
        } else {
          console.error(`Error: Failed to delete key '${deleteName}'. Key may not exist.`);
          process.exit(1);
        }
        break;
        
      case 'migrate':
        // One-shot migration of legacy per-key items into the single vault.
        // eslint-disable-next-line no-console
        console.log('Migrating legacy keychain items into the single vault...');
        // eslint-disable-next-line no-console
        console.log('(macOS may prompt once per legacy key — click "Always Allow" to breeze through.)');
        const report = await keychain.migrateToVault();
        // eslint-disable-next-line no-console
        console.log(`\nMigrated: ${report.migrated.length} key(s)`);
        // eslint-disable-next-line no-console
        console.log(`Deleted legacy items: ${report.deleted.length}`);
        if (report.skipped.length > 0) {
          console.error(`Skipped (left in place, verification failed): ${report.skipped.join(', ')}`);
        }
        // eslint-disable-next-line no-console
        console.log('\nDone. All keys now live in one keychain item — expect a single prompt from now on.');
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
    if (isServeMyAPIError(error)) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function printUsage() {
  // eslint-disable-next-line no-console
  console.log(`
Usage: api-key <command> [options]

Commands:
  list                          List all stored API keys
  get <key-name>                Retrieve the value of an API key
  store <key-name> <key-value>  Store a new API key
  add <key-name> <key-value>    Alias for 'store'
  delete <key-name>             Delete an API key
  remove <key-name>             Alias for 'delete'
  migrate                       Consolidate legacy per-key items into one vault
  help                          Show this help message

Examples:
  api-key list
  api-key get github_token
  api-key store github_token ghp_123456789abcdefg
  api-key delete github_token
`);
}

main().catch(err => {
  if (isServeMyAPIError(err)) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});