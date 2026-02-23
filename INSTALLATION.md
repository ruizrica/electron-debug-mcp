# 📦 Installation Guide - Electron Debug MCP Server

This guide explains how to install and configure the Electron Debug MCP Server in your project or MCP client.

## Table of Contents

- [Installation Methods](#installation-methods)
- [Configuration for MCP Clients](#configuration-for-mcp-clients)
  - [Cursor IDE](#cursor-ide)
  - [Claude Desktop](#claude-desktop)
  - [Custom MCP Client](#custom-mcp-client)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

---

## Installation Methods

### Method 1: Install as a Dependency (Recommended for Development)

If you want to use this MCP server in your own project:

```bash
# Clone or copy the electron-debug-mcp directory
cd /path/to/your/project

# Install dependencies
cd electron-debug-mcp
npm install

# Build the project
npm run build
```

### Method 2: Install Globally (For System-Wide Use)

```bash
# Navigate to the electron-debug-mcp directory
cd /path/to/electron-debug-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Create a global symlink (optional)
npm link
```

### Method 3: Use as NPM Package (If Published)

```bash
npm install -g electron-debug-mcp
```

---

## Configuration for MCP Clients

### Cursor IDE

1. **Locate Cursor's MCP configuration file:**
   - **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/mcp.json`
   - **Windows**: `%APPDATA%\Cursor\User\globalStorage\mcp.json`
   - **Linux**: `~/.config/Cursor/User/globalStorage/mcp.json`

2. **Add the Electron Debug MCP server configuration:**

```json
{
  "mcpServers": {
    "electron-debug": {
      "command": "node",
      "args": [
        "/absolute/path/to/electron-debug-mcp/build/index.js"
      ],
      "env": {}
    }
  }
}
```

**Example for macOS:**
```json
{
  "mcpServers": {
    "electron-debug": {
      "command": "node",
      "args": [
        "/Users/ricardo/Workshop/GitHub/electron-debug-mcp/build/index.js"
      ]
    }
  }
}
```

3. **Restart Cursor** for changes to take effect.

4. **Verify installation:**
   - Open Cursor's MCP panel
   - You should see "electron-debug" server listed
   - Available tools: `electron_start`, `electron_stop`, `electron_list`, etc.

---

### Claude Desktop

1. **Locate Claude Desktop's configuration file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. **Add the Electron Debug MCP server:**

```json
{
  "mcpServers": {
    "electron-debug": {
      "command": "node",
      "args": [
        "/absolute/path/to/electron-debug-mcp/build/index.js"
      ]
    }
  }
}
```

3. **Restart Claude Desktop**.

---

### Custom MCP Client

If you're building a custom MCP client, connect to the server via stdio:

```javascript
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Start the MCP server process
const serverProcess = spawn('node', [
  '/path/to/electron-debug-mcp/build/index.js'
], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Create transport and client
const transport = new StdioClientTransport({
  command: serverProcess,
  env: {}
});

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

// Connect to the server
await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools.tools);

// Use a tool
const result = await client.callTool({
  name: 'electron_start',
  arguments: {
    appPath: '/path/to/your/electron/app'
  }
});
```

---

## Usage Examples

### Starting an Electron Application

```javascript
// Using MCP client
const response = await mcpClient.callTool({
  name: "electron_start",
  arguments: {
    appPath: "/path/to/your/electron/app",
    debugPort: 9222,  // Optional
    startupTimeout: 30000  // Optional
  }
});

console.log('Process started:', response.content[0].text);
// Output: {"processId":"electron-1234567890","name":"your-app","status":"running",...}
```

### Listing Running Electron Processes

```javascript
const response = await mcpClient.callTool({
  name: "electron_list",
  arguments: {}
});

const processes = JSON.parse(response.content[0].text);
console.log('Running processes:', processes.processes);
```

### Executing JavaScript in a Page

```javascript
const response = await mcpClient.callTool({
  name: "electron_evaluate",
  arguments: {
    processId: "electron-1234567890",
    targetId: "page-1",
    expression: "document.title",
    returnByValue: true
  }
});

const result = JSON.parse(response.content[0].text);
console.log('Page title:', result.result);
```

### Reloading a Page

```javascript
await mcpClient.callTool({
  name: "electron_reload",
  arguments: {
    processId: "electron-1234567890",
    targetId: "page-1"  // Optional - reloads all if omitted
  }
});
```

### Stopping an Electron Process

```javascript
const response = await mcpClient.callTool({
  name: "electron_stop",
  arguments: {
    processId: "electron-1234567890"
  }
});

const result = JSON.parse(response.content[0].text);
console.log('Stopped:', result.success);
```

---

## Available Tools

| Tool Name | Description | Required Arguments |
|-----------|-------------|-------------------|
| `electron_start` | Start an Electron app with debugging | `appPath` |
| `electron_stop` | Stop a running Electron process | `processId` |
| `electron_list` | List all running Electron processes | None |
| `electron_reload` | Reload a page or application | `processId` |
| `electron_evaluate` | Execute JavaScript in page context | `processId`, `targetId`, `expression` |
| `electron_pause` | Pause JavaScript execution | `processId`, `targetId` |
| `electron_resume` | Resume JavaScript execution | `processId`, `targetId` |

---

## Available Resources

| Resource URI | Description |
|--------------|-------------|
| `electron://info` | Overview of all running processes |
| `electron://process/{id}` | Detailed debug info for a process |
| `electron://logs/{id}` | Access to process logs |
| `electron://targets` | List of all available debug targets |
| `electron://cdp/{processId}/{targetId}` | CDP access for a specific target |

---

## Troubleshooting

### Server Won't Start

**Problem:** The MCP server fails to start.

**Solutions:**
1. Verify Node.js is installed: `node --version` (requires Node.js 18+)
2. Check the build directory exists: `ls build/index.js`
3. Rebuild if needed: `npm run build`
4. Check file permissions: `chmod +x build/index.js`

### Tools Not Available

**Problem:** Tools don't appear in your MCP client.

**Solutions:**
1. Verify the configuration file path is correct
2. Use absolute paths in configuration (not relative)
3. Restart your MCP client after configuration changes
4. Check server logs for errors

### Electron Process Not Starting

**Problem:** `electron_start` tool fails.

**Solutions:**
1. Verify Electron is installed: `npm list electron`
2. Check the app path is correct and accessible
3. Ensure debug port is available (default: auto-select 9222-9999)
4. Check Electron app has debugging enabled

### Port Already in Use

**Problem:** Debug port conflicts.

**Solutions:**
1. Specify a different port: `debugPort: 9223`
2. Let the server auto-select: omit `debugPort` parameter
3. Check for other Electron processes: `electron_list` tool

### TypeScript Compilation Errors

**Problem:** Build fails with TypeScript errors.

**Solutions:**
1. Install dependencies: `npm install`
2. Check TypeScript version: `npx tsc --version`
3. Clean and rebuild: `rm -rf build && npm run build`
4. Check for type errors: `npm run build 2>&1 | grep error`

---

## Development Setup

If you want to modify the MCP server:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode (rebuilds on changes)
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

---

## Environment Variables

The MCP server can be configured with environment variables:

- `ELECTRON_DEBUG_PORT`: Default debug port (default: auto-select)
- `ELECTRON_STARTUP_TIMEOUT`: Startup timeout in ms (default: 30000)
- `LOG_LEVEL`: Logging level (default: info)

---

## Support

For issues or questions:
1. Check the [README.md](./README.md) for detailed documentation
2. Review test files in `tests/` for usage examples
3. Check MCP client logs for error messages

---

## Next Steps

After installation:
1. ✅ Verify the server appears in your MCP client
2. ✅ Test with `electron_list` to see available tools
3. ✅ Start an Electron app with `electron_start`
4. ✅ Explore available resources via your MCP client

Happy debugging! 🚀
