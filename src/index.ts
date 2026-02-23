import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pathToFileURL } from 'url';
import CDP, { CDPClient } from 'chrome-remote-interface';
import * as net from 'net';
import {
  ELECTRON_RESOURCES,
  parseElectronResourceUri,
  jsonResourceResponse,
  textResourceResponse
} from './resourceRouting.js';

// Note: Operations have been moved to tools (electron_start, electron_stop, etc.)
// See ListToolsRequestSchema and CallToolRequestSchema handlers

// Type definitions for Electron processes and debugging info
interface ElectronProcess {
  id: string;
  process: ChildProcess;
  name: string;
  status: 'running' | 'stopped' | 'crashed';
  pid?: number;
  debugPort?: number;
  startTime: Date;
  logs: string[];
  appPath: string;
  cdpClient?: CDPClient; // Chrome DevTools Protocol client
  targets?: CDPTarget[]; // Available debugging targets
  lastTargetUpdate?: Date; // When targets were last updated
}

interface ElectronDebugInfo {
  webContents: ElectronWebContentsInfo[];
  processes: {
    main: ProcessInfo;
    renderers: ProcessInfo[];
  };
}

interface ElectronWebContentsInfo {
  id: number;
  url: string;
  title: string;
  debuggable: boolean;
  debugPort?: number;
  targetId?: string; // CDP target ID
}

interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
}

interface ProcessInfo {
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  status: string;
}

interface McpRuntimeState {
  electronProcesses: Map<string, ElectronProcess>;
}

function createRuntimeState(): McpRuntimeState {
  return {
    electronProcesses: new Map<string, ElectronProcess>()
  };
}

// Helper functions for Electron debugging

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

export function getElectronExecutablePath(): string {
  const platform = os.platform();
  const possiblePaths: string[] = [];

  if (platform === 'win32') {
    // Windows paths
    possiblePaths.push(
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'electron.cmd'),
      path.resolve(process.cwd(), 'node_modules', '.bin', 'electron.cmd'),
      path.resolve(process.cwd(), 'node_modules', 'electron', 'dist', 'electron.exe')
    );
  } else if (platform === 'darwin') {
    // macOS paths
    possiblePaths.push(
      path.resolve(process.cwd(), 'node_modules', '.bin', 'electron'),
      path.resolve(process.cwd(), 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron'),
      path.join(os.homedir(), '.npm-global', 'bin', 'electron')
    );
  } else {
    // Linux paths
    possiblePaths.push(
      path.resolve(process.cwd(), 'node_modules', '.bin', 'electron'),
      path.resolve(process.cwd(), 'node_modules', 'electron', 'dist', 'electron'),
      path.join(os.homedir(), '.npm-global', 'bin', 'electron'),
      path.join(os.homedir(), '.local', 'bin', 'electron')
    );
  }

  // Check each possible path
  for (const electronPath of possiblePaths) {
    if (fs.existsSync(electronPath)) {
      return electronPath;
    }
  }

  // Default to expecting electron to be in PATH
  return 'electron';
}

async function startElectronApp(state: McpRuntimeState, appPath: string, debugPort?: number, startupTimeout: number = 30000): Promise<ElectronProcess> {
  const id = `electron-${Date.now()}`;
  const args = [appPath];
  
  // If no debug port specified, find an available port between 9222 and 9999
  if (!debugPort) {
    for (let port = 9222; port <= 9999; port++) {
      if (await isPortAvailable(port)) {
        debugPort = port;
        break;
      }
    }
    if (!debugPort) {
      throw new Error('No available debug port found in range 9222-9999');
    }
  } else {
    // Check if specified port is available
    const available = await isPortAvailable(debugPort);
    if (!available) {
      throw new Error(`Debug port ${debugPort} is not available`);
    }
  }
  
  // Add debugging flags
  args.unshift(`--remote-debugging-port=${debugPort}`);
  args.unshift('--enable-logging');
  
  const electronPath = getElectronExecutablePath();
  const electronProc = spawn(electronPath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  });
  
  const electronProcess: ElectronProcess = {
    id,
    process: electronProc,
    name: path.basename(appPath),
    status: 'running',
    pid: electronProc.pid,
    debugPort,
    startTime: new Date(),
    logs: [],
    appPath
  };
  
  // Capture stdout and stderr
  const MAX_LOG_ENTRIES = 1000; // Prevent memory leak by limiting log entries
  
  const addLog = (log: string) => {
    electronProcess.logs.push(log);
    // Rotate logs if exceeding maximum size
    if (electronProcess.logs.length > MAX_LOG_ENTRIES) {
      // Remove enough entries to bring back to MAX_LOG_ENTRIES
      // This ensures the array never exceeds the limit, even with rapid log additions
      const removeCount = electronProcess.logs.length - MAX_LOG_ENTRIES;
      electronProcess.logs.splice(0, removeCount);
    }
  };
  
  electronProc.stdout.on('data', (data: Buffer) => {
    const log = data.toString();
    addLog(log);
    // Log to console instead of sending notifications
    console.log(`[Electron ${id}] ${log}`);
  });
  
  electronProc.stderr.on('data', (data: Buffer) => {
    const log = data.toString();
    addLog(log);
    // Log to console instead of sending notifications
    console.error(`[Electron ${id}] ${log}`);
  });
  
  // Handle process exit
  electronProc.on('exit', (code: number | null) => {
    electronProcess.status = code === 0 ? 'stopped' : 'crashed';
    console.info(`[Electron ${id}] Process exited with code ${code}`);
    
    // Clean up CDP client if it exists
    if (electronProcess.cdpClient) {
      try {
        electronProcess.cdpClient.close();
      } catch (err) {
        console.error(`[Electron ${id}] Error closing CDP client:`, err);
      }
      electronProcess.cdpClient = undefined;
    }
    
    // Remove process from map on exit
    state.electronProcesses.delete(id);
  });
  
  state.electronProcesses.set(id, electronProcess);
  
  // Wait for the app to start and initialize the debugging port with timeout
  const startTime = Date.now();
  let connected = false;
  
  while (Date.now() - startTime < startupTimeout) {
    try {
      await updateCDPTargets(electronProcess);
      connected = true;
      break;
    } catch (err) {
      // Port not ready yet, wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  if (!connected) {
    console.warn(`[Electron ${id}] Could not connect to CDP within ${startupTimeout}ms timeout`);
  }
  
  return electronProcess;
}

function stopElectronApp(state: McpRuntimeState, id: string): boolean {
  const electronProcess = state.electronProcesses.get(id);
  if (!electronProcess) {
    return false;
  }
  
  // Close CDP client if it exists
  if (electronProcess.cdpClient) {
    try {
      electronProcess.cdpClient.close();
    } catch (err) {
      console.error(`[Electron ${id}] Error closing CDP client:`, err);
    }
    electronProcess.cdpClient = undefined;
  }
  
  electronProcess.process.kill();
  electronProcess.status = 'stopped';
  
  // Remove process from map
  state.electronProcesses.delete(id);
  
  return true;
}

export async function getElectronDebugInfo(id: string, state?: McpRuntimeState): Promise<ElectronDebugInfo | null> {
  const activeState = state ?? defaultRuntimeState;
  const electronProcess = activeState.electronProcesses.get(id);
  if (!electronProcess || electronProcess.status !== 'running') {
    return null;
  }
  
  // Update CDP targets to get the latest information
  try {
    await updateCDPTargets(electronProcess);
  } catch (err) {
    console.warn(`[Electron ${id}] Could not update CDP targets:`, err);
  }
  
  // Convert CDP targets to WebContents info
  const webContents: ElectronWebContentsInfo[] = electronProcess.targets?.map((target, index) => ({
    id: index + 1,
    url: target.url,
    title: target.title,
    debuggable: !!target.webSocketDebuggerUrl,
    debugPort: electronProcess.debugPort,
    targetId: target.id
  })) || [
    {
      id: 1,
      url: 'file://' + electronProcess.appPath,
      title: electronProcess.name,
      debuggable: true,
      debugPort: electronProcess.debugPort
    }
  ];
  
  // Try to get real metrics from CDP, fallback to unavailable
  let mainCpuUsage: number | 'unavailable' = 'unavailable';
  let mainMemoryUsage: number | 'unavailable' = 'unavailable';
  let rendererCpuUsage: number | 'unavailable' = 'unavailable';
  let rendererMemoryUsage: number | 'unavailable' = 'unavailable';

  if (electronProcess.cdpClient) {
    try {
      // Try to get performance metrics from CDP Performance domain
      const performanceMetrics = await electronProcess.cdpClient.send('Performance.getMetrics') as unknown;
      if (performanceMetrics && typeof performanceMetrics === 'object' && 'metrics' in performanceMetrics) {
        const metrics = (performanceMetrics as { metrics: Array<{ name: string; value: number }> }).metrics;
        const cpuMetric = metrics.find(m => m.name === 'CPUUsage');
        const memoryMetric = metrics.find(m => m.name === 'JSHeapUsedSize');
        
        if (cpuMetric) {
          mainCpuUsage = cpuMetric.value;
          rendererCpuUsage = cpuMetric.value * 0.5; // Estimate renderer as half
        }
        if (memoryMetric) {
          mainMemoryUsage = memoryMetric.value;
          rendererMemoryUsage = memoryMetric.value * 0.5; // Estimate renderer as half
        }
      }
    } catch (err) {
      // CDP metrics not available, keep as 'unavailable'
      console.warn(`[Electron ${id}] Could not get performance metrics:`, err);
    }
  }

  return {
    webContents,
    processes: {
      main: {
        pid: electronProcess.pid || 0,
        cpuUsage: typeof mainCpuUsage === 'number' ? mainCpuUsage : 0,
        memoryUsage: typeof mainMemoryUsage === 'number' ? mainMemoryUsage : 0,
        status: 'running'
      },
      renderers: [
        {
          pid: (electronProcess.pid || 0) + 1,
          cpuUsage: typeof rendererCpuUsage === 'number' ? rendererCpuUsage : 0,
          memoryUsage: typeof rendererMemoryUsage === 'number' ? rendererMemoryUsage : 0,
          status: 'running'
        }
      ]
    }
  };
}

// Add CDP-related functions

/**
 * Updates the CDP targets for an Electron process
 */
async function updateCDPTargets(electronProcess: ElectronProcess): Promise<CDPTarget[]> {
  if (!electronProcess.debugPort) {
    throw new Error('No debug port available for this Electron process');
  }
  
  try {
    // Get the list of available targets from the Chrome DevTools Protocol
    const response = await fetch(`http://localhost:${electronProcess.debugPort}/json/list`);
    if (!response.ok) {
      throw new Error(`Failed to get targets: ${response.statusText}`);
    }
    
    const targets = await response.json() as CDPTarget[];
    electronProcess.targets = targets;
    electronProcess.lastTargetUpdate = new Date();
    return targets;
  } catch (error) {
    console.error(`Error getting CDP targets for process ${electronProcess.id}:`, error);
    throw error;
  }
}

/**
 * Connects to a specific CDP target
 */
async function connectToCDPTarget(electronProcess: ElectronProcess, targetId: string): Promise<CDPClient> {
  if (!electronProcess.debugPort) {
    throw new Error('No debug port available for this Electron process');
  }
  
  try {
    // Make sure we have the latest targets
    if (!electronProcess.targets || !electronProcess.lastTargetUpdate || 
        (new Date().getTime() - electronProcess.lastTargetUpdate.getTime() > 5000)) {
      await updateCDPTargets(electronProcess);
    }
    
    // Find the target
    const target = electronProcess.targets?.find(t => t.id === targetId);
    if (!target) {
      throw new Error(`Target ${targetId} not found`);
    }
    
    // Connect to the target using CDP
    const client = await CDP({
      target: targetId,
      port: electronProcess.debugPort
    });
    
    // Store the client for later use
    electronProcess.cdpClient = client;
    return client;
  } catch (error) {
    console.error(`Error connecting to CDP target ${targetId}:`, error);
    throw error;
  }
}

/**
 * Executes a CDP command on a target
 */
async function executeCDPCommand(electronProcess: ElectronProcess, targetId: string, domain: string, command: string, params: Record<string, unknown> = {}): Promise<unknown> {
  let client;
  
  try {
    // Get or create a CDP client
    if (electronProcess.cdpClient) {
      client = electronProcess.cdpClient;
    } else {
      client = await connectToCDPTarget(electronProcess, targetId);
    }
    
    // Execute the command
    return await client.send(`${domain}.${command}`, params);
  } catch (error) {
    console.error(`Error executing CDP command ${domain}.${command}:`, error);
    throw error;
  }
}

function requireRunningElectronProcess(state: McpRuntimeState, processId: string): ElectronProcess {
  const process = state.electronProcesses.get(processId);
  if (!process || process.status !== 'running') {
    throw new Error(`Process ${processId} not found or not running`);
  }

  return process;
}

function createConfiguredMcpServer(runtimeState: McpRuntimeState): Server {
  const server = new Server(
    {
      name: "electron-debug-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = [
      {
        uri: ELECTRON_RESOURCES.INFO,
        name: "Electron Debugging Info",
        description: "Information about the Electron debugging capabilities",
        mimeType: "application/json",
      },
      {
        uri: ELECTRON_RESOURCES.TARGETS,
        name: "Electron Debug Targets",
        description: "List all available debug targets across Electron processes",
        mimeType: "application/json",
      }
    ];

    for (const [id, process] of runtimeState.electronProcesses.entries()) {
      resources.push({
        uri: `${ELECTRON_RESOURCES.PROCESS}${id}`,
        name: `Electron Process: ${process.name}`,
        description: `Debug information for Electron process ${process.name}`,
        mimeType: "application/json",
      });

      resources.push({
        uri: `${ELECTRON_RESOURCES.LOGS}${id}`,
        name: `Electron Logs: ${process.name}`,
        description: `Logs for Electron process ${process.name}`,
        mimeType: "text/plain",
      });

      if (process.targets && process.targets.length > 0) {
        for (const target of process.targets) {
          resources.push({
            uri: `${ELECTRON_RESOURCES.CDP}${id}/${target.id}`,
            name: `CDP: ${target.title || target.url}`,
            description: `Chrome DevTools Protocol access for target ${target.id}`,
            mimeType: "application/json",
          });
        }
      }
    }

    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const route = parseElectronResourceUri(uri);

    switch (route.kind) {
      case 'targets': {
        const allTargets: Array<{ processId: string; target: CDPTarget }> = [];

        for (const [id, process] of runtimeState.electronProcesses.entries()) {
          if (process.status === 'running' && process.debugPort) {
            try {
              await updateCDPTargets(process);
              if (process.targets) {
                for (const target of process.targets) {
                  allTargets.push({
                    processId: id,
                    target
                  });
                }
              }
            } catch (err) {
              console.warn(`Could not update targets for process ${id}:`, err);
            }
          }
        }

        return jsonResourceResponse(uri, allTargets);
      }

      case 'cdp': {
        const process = requireRunningElectronProcess(runtimeState, route.processId);

        if (!route.commandPath) {
          if (!process.targets?.some(t => t.id === route.targetId) && process.debugPort) {
            try {
              await updateCDPTargets(process);
            } catch (err) {
              console.warn(`Could not update targets for process ${route.processId}:`, err);
            }
          }

          const target = process.targets?.find(t => t.id === route.targetId);
          if (!target) {
            throw new Error(`Target ${route.targetId} not found in process ${route.processId}`);
          }

          return jsonResourceResponse(uri, {
            target,
            availableDomains: [
              'Page', 'Runtime', 'Debugger', 'DOM', 'Network', 'Console',
              'Memory', 'Profiler', 'Performance', 'HeapProfiler'
            ],
            usage: `To execute a CDP command, append /{domain}/{command} to this URI`
          });
        }

        const commandParts = route.commandPath.split('/');
        if (commandParts.length !== 2 || !commandParts[0] || !commandParts[1]) {
          throw new Error(`Invalid CDP command format: ${route.commandPath}. Expected format: {domain}/{command}`);
        }

        const domain = commandParts[0];
        const method = commandParts[1];

        try {
          const result = await executeCDPCommand(process, route.targetId, domain, method);
          return jsonResourceResponse(uri, result);
        } catch (error) {
          throw new Error(`Error executing CDP command: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      case 'invalidCdp':
        throw new Error(`Invalid CDP URI: ${uri}`);

      case 'info':
        return jsonResourceResponse(uri, {
          activeProcesses: Array.from(runtimeState.electronProcesses.entries()).map(([id, proc]) => ({
            id,
            name: proc.name,
            status: proc.status,
            pid: proc.pid,
            startTime: proc.startTime
          }))
        });

      case 'process': {
        const debugInfo = await getElectronDebugInfo(route.processId, runtimeState);
        if (!debugInfo) {
          throw new Error(`Process ${route.processId} not found or not running`);
        }

        return jsonResourceResponse(uri, debugInfo);
      }

      case 'logs': {
        const process = runtimeState.electronProcesses.get(route.processId);
        if (!process) {
          throw new Error(`Process ${route.processId} not found`);
        }

        return textResourceResponse(uri, process.logs.join('\n'));
      }

      case 'unknown':
      default:
        throw new Error(`Resource not found: ${uri}`);
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "electron_start",
          description: "Start an Electron application with debugging enabled",
          inputSchema: {
            type: "object",
            properties: {
              appPath: {
                type: "string",
                description: "Path to the Electron application to start"
              },
              debugPort: {
                type: "number",
                description: "Optional debugging port (default: auto-select available port)"
              },
              startupTimeout: {
                type: "number",
                description: "Optional startup timeout in milliseconds (default: 30000)"
              }
            },
            required: ["appPath"]
          }
        },
        {
          name: "electron_stop",
          description: "Stop a running Electron process",
          inputSchema: {
            type: "object",
            properties: {
              processId: {
                type: "string",
                description: "ID of the Electron process to stop"
              }
            },
            required: ["processId"]
          }
        },
        {
          name: "electron_list",
          description: "List all running Electron processes",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "electron_reload",
          description: "Reload a specific page or application",
          inputSchema: {
            type: "object",
            properties: {
              processId: {
                type: "string",
                description: "ID of the Electron process"
              },
              targetId: {
                type: "string",
                description: "Optional target ID to reload specific page (reloads all if not specified)"
              }
            },
            required: ["processId"]
          }
        },
        {
          name: "electron_evaluate",
          description: "Execute JavaScript in a page context",
          inputSchema: {
            type: "object",
            properties: {
              processId: {
                type: "string",
                description: "ID of the Electron process"
              },
              targetId: {
                type: "string",
                description: "CDP target ID"
              },
              expression: {
                type: "string",
                description: "JavaScript expression to evaluate"
              },
              returnByValue: {
                type: "boolean",
                description: "Whether to return the result by value (default: true)"
              }
            },
            required: ["processId", "targetId", "expression"]
          }
        },
        {
          name: "electron_pause",
          description: "Pause JavaScript execution",
          inputSchema: {
            type: "object",
            properties: {
              processId: {
                type: "string",
                description: "ID of the Electron process"
              },
              targetId: {
                type: "string",
                description: "CDP target ID"
              }
            },
            required: ["processId", "targetId"]
          }
        },
        {
          name: "electron_resume",
          description: "Resume JavaScript execution",
          inputSchema: {
            type: "object",
            properties: {
              processId: {
                type: "string",
                description: "ID of the Electron process"
              },
              targetId: {
                type: "string",
                description: "CDP target ID"
              }
            },
            required: ["processId", "targetId"]
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "electron_start": {
          const { appPath, debugPort, startupTimeout } = args as {
            appPath: string;
            debugPort?: number;
            startupTimeout?: number;
          };
          const process = await startElectronApp(runtimeState, appPath, debugPort, startupTimeout);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  processId: process.id,
                  name: process.name,
                  status: process.status,
                  pid: process.pid,
                  debugPort: process.debugPort,
                  appPath: process.appPath
                }, null, 2)
              }
            ]
          };
        }

        case "electron_stop": {
          const { processId } = args as { processId: string };
          const stopped = stopElectronApp(runtimeState, processId);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: stopped,
                  processId
                }, null, 2)
              }
            ]
          };
        }

        case "electron_list": {
          const processes = Array.from(runtimeState.electronProcesses.entries()).map(([id, proc]) => ({
            id,
            name: proc.name,
            status: proc.status,
            pid: proc.pid,
            startTime: proc.startTime.toISOString(),
            appPath: proc.appPath,
            debugPort: proc.debugPort
          }));
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ processes }, null, 2)
              }
            ]
          };
        }

        case "electron_reload": {
          const { processId, targetId } = args as { processId: string; targetId?: string };
          const process = runtimeState.electronProcesses.get(processId);
          if (!process || process.status !== 'running') {
            throw new Error(`Process ${processId} not found or not running`);
          }

          if (targetId) {
            await executeCDPCommand(process, targetId, "Page", "reload");
          } else if (process.targets) {
            for (const target of process.targets) {
              try {
                await executeCDPCommand(process, target.id, "Page", "reload");
              } catch (err) {
                console.warn(`Failed to reload target ${target.id}:`, err);
              }
            }
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  processId,
                  targetId: targetId || "all"
                }, null, 2)
              }
            ]
          };
        }

        case "electron_evaluate": {
          const { processId, targetId, expression, returnByValue = true } = args as {
            processId: string;
            targetId: string;
            expression: string;
            returnByValue?: boolean;
          };
          const process = runtimeState.electronProcesses.get(processId);
          if (!process || process.status !== 'running') {
            throw new Error(`Process ${processId} not found or not running`);
          }

          const result = await executeCDPCommand(process, targetId, "Runtime", "evaluate", {
            expression,
            returnByValue
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  result,
                  processId,
                  targetId
                }, null, 2)
              }
            ]
          };
        }

        case "electron_pause": {
          const { processId, targetId } = args as { processId: string; targetId: string };
          const process = runtimeState.electronProcesses.get(processId);
          if (!process || process.status !== 'running') {
            throw new Error(`Process ${processId} not found or not running`);
          }

          await executeCDPCommand(process, targetId, "Debugger", "pause");

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  processId,
                  targetId
                }, null, 2)
              }
            ]
          };
        }

        case "electron_resume": {
          const { processId, targetId } = args as { processId: string; targetId: string };
          const process = runtimeState.electronProcesses.get(processId);
          if (!process || process.status !== 'running') {
            throw new Error(`Process ${processId} not found or not running`);
          }

          await executeCDPCommand(process, targetId, "Debugger", "resume");

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  processId,
                  targetId
                }, null, 2)
              }
            ]
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

export function createMcpServer(): Server {
  return createConfiguredMcpServer(createRuntimeState());
}

const defaultRuntimeState = createRuntimeState();
const defaultServer = createConfiguredMcpServer(defaultRuntimeState);

// Start server using stdio transport
export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await defaultServer.connect(transport);
  console.info('{"jsonrpc": "2.0", "method": "log", "params": { "message": "Electron Debug MCP Server running..." }}');
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  startMcpServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start Electron Debug MCP Server: ${message}`);
    process.exitCode = 1;
  });
}
