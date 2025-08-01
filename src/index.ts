import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { spawn, ChildProcess } from 'child_process';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  description: string;
  prefix: string;
}

interface ConnectedServer {
  name: string;
  config: MCPServerConfig;
  process?: ChildProcess;
  transport?: StdioServerTransport;
  tools: Map<string, any>;
  status: 'starting' | 'ready' | 'error' | 'stopped';
  lastError?: string;
}

class MCPAggregatorServer {
  private server: McpServer;
  private connectedServers: Map<string, ConnectedServer> = new Map();
  private app: express.Application;

  constructor() {
    this.server = new McpServer({
      name: 'MCP Aggregator',
      version: '1.0.0'
    });

    this.app = express();
    this.setupExpress();
    this.initializeGatewayTools();
    this.loadServerConfigurations();
  }

  private setupExpress() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Allow SSE
    }));
    
    // CORS for localhost only (secure tunnel approach)
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true
    }));

    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const serverStatuses = Object.fromEntries(
        Array.from(this.connectedServers.entries()).map(([name, server]) => [
          name, 
          { status: server.status, toolCount: server.tools.size }
        ])
      );

      res.json({
        status: 'healthy',
        aggregator: {
          name: 'MCP Aggregator',
          version: '1.0.0',
          connectedServers: serverStatuses,
          totalTools: Array.from(this.connectedServers.values())
            .reduce((sum, server) => sum + server.tools.size, 0)
        },
        timestamp: new Date().toISOString()
      });
    });

    // SSE endpoint for MCP communication
    this.app.get('/mcp', (req, res) => {
      console.log('New MCP connection from Claude Desktop');
      
      // Set up SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true'
      });

      // Create SSE transport
      const transport = new SSEServerTransport('/mcp', res);
      
      // Connect the MCP server to this transport
      this.server.connect(transport).catch(error => {
        console.error('Failed to connect MCP server to transport:', error);
        res.end();
      });

      // Handle client disconnect
      req.on('close', () => {
        console.log('MCP client disconnected');
        transport.close();
      });
    });
  }

  private initializeGatewayTools() {
    // Gateway info tool
    this.server.tool('whoami', 'Get aggregator info and connected servers', {}, async () => {
      const serverInfo = Object.fromEntries(
        Array.from(this.connectedServers.entries()).map(([name, server]) => [
          name,
          {
            status: server.status,
            description: server.config.description,
            prefix: server.config.prefix,
            toolCount: server.tools.size,
            tools: Array.from(server.tools.keys())
          }
        ])
      );

      return {
        content: [{
          text: JSON.stringify({
            aggregator: {
              name: 'MCP Aggregator',
              version: '1.0.0',
              authentication: 'SSH Tunnel (localhost-only)',
              connectedServers: Object.keys(serverInfo).length,
              totalTools: Object.values(serverInfo).reduce((sum: number, s: any) => sum + s.toolCount, 0)
            },
            servers: serverInfo
          }, null, 2),
          type: 'text'
        }]
      };
    });

    // List servers tool
    this.server.tool('list-servers', 'List all connected MCP servers and their tools', {}, async () => {
      const servers = Array.from(this.connectedServers.entries()).map(([name, server]) => ({
        name,
        status: server.status,
        description: server.config.description,
        prefix: server.config.prefix,
        toolCount: server.tools.size,
        tools: Array.from(server.tools.keys()),
        lastError: server.lastError
      }));

      return {
        content: [{
          text: JSON.stringify({ servers }, null, 2),
          type: 'text'
        }]
      };
    });
  }

  private loadServerConfigurations() {
    const configPath = path.join(__dirname, '../config/servers.json');
    
    if (!fs.existsSync(configPath)) {
      console.warn('No server configuration file found. Creating default config...');
      this.createDefaultConfig(configPath);
    }

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config.servers.forEach((serverConfig: MCPServerConfig) => {
        this.addServer(serverConfig);
      });
    } catch (error) {
      console.error('Failed to load server configuration:', error);
    }
  }

  private createDefaultConfig(configPath: string) {
    const fs = require('fs');
    const path = require('path');
    
    const defaultConfig = {
      servers: [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', '/tmp', '/Users'],
          description: 'File system operations - read, write, and manage files',
          prefix: 'fs'
        },
        {
          name: 'github',
          command: 'npx',
          args: ['@modelcontextprotocol/server-github'],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || 'your-token-here'
          },
          description: 'GitHub operations - repositories, issues, pull requests',
          prefix: 'github'
        },
        {
          name: 'brave-search',
          command: 'npx',
          args: ['@modelcontextprotocol/server-brave-search'],
          env: {
            BRAVE_API_KEY: process.env.BRAVE_API_KEY || 'your-api-key-here'
          },
          description: 'Web search using Brave Search API',
          prefix: 'web'
        }
      ]
    };

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`Created default configuration at ${configPath}`);
  }

  private async addServer(config: MCPServerConfig) {
    console.log(`Adding MCP server: ${config.name}`);
    
    const connectedServer: ConnectedServer = {
      name: config.name,
      config,
      tools: new Map(),
      status: 'starting'
    };

    this.connectedServers.set(config.name, connectedServer);

    try {
      // Spawn the MCP server process
      const childProcess = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      connectedServer.process = childProcess;

      // Create transport to communicate with the child MCP server
      const transport = new StdioServerTransport();
      connectedServer.transport = transport;

      // Handle process events
      childProcess.on('error', (error) => {
        console.error(`Server ${config.name} process error:`, error);
        connectedServer.status = 'error';
        connectedServer.lastError = error.message;
      });

      childProcess.on('exit', (code) => {
        console.log(`Server ${config.name} exited with code ${code}`);
        connectedServer.status = 'stopped';
      });

      // For now, mark as ready (we'll implement proper tool discovery later)
      connectedServer.status = 'ready';
      console.log(`Server ${config.name} started successfully`);

      // Add placeholder tools for each server
      this.addPlaceholderTools(config);

    } catch (error) {
      console.error(`Failed to start server ${config.name}:`, error);
      connectedServer.status = 'error';
      connectedServer.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  private addPlaceholderTools(config: MCPServerConfig) {
    // Add prefixed placeholder tools based on server type
    switch (config.name) {
      case 'filesystem':
        this.addTool(`${config.prefix}:read-file`, 'Read a file from the filesystem', {
          path: { type: 'string', description: 'Path to the file to read' }
        }, async ({ path }: { path: string }) => ({
          content: [{
            text: `[${config.prefix}] Reading file: ${path}\n(Tool will be connected to real filesystem MCP server)`,
            type: 'text'
          }]
        }));
        
        this.addTool(`${config.prefix}:write-file`, 'Write content to a file', {
          path: { type: 'string', description: 'Path to the file to write' },
          content: { type: 'string', description: 'Content to write to the file' }
        }, async ({ path, content }: { path: string; content: string }) => ({
          content: [{
            text: `[${config.prefix}] Writing to file: ${path}\n(Tool will be connected to real filesystem MCP server)`,
            type: 'text'
          }]
        }));
        break;

      case 'github':
        this.addTool(`${config.prefix}:search-repositories`, 'Search GitHub repositories', {
          query: { type: 'string', description: 'Search query for repositories' }
        }, async ({ query }: { query: string }) => ({
          content: [{
            text: `[${config.prefix}] Searching repositories for: ${query}\n(Tool will be connected to real GitHub MCP server)`,
            type: 'text'
          }]
        }));
        break;

      case 'brave-search':
        this.addTool(`${config.prefix}:search`, 'Search the web using Brave Search', {
          query: { type: 'string', description: 'Search query' }
        }, async ({ query }: { query: string }) => ({
          content: [{
            text: `[${config.prefix}] Web search for: ${query}\n(Tool will be connected to real Brave Search MCP server)`,
            type: 'text'
          }]
        }));
        break;
    }
  }

  private addTool(name: string, description: string, inputSchema: any, handler: any) {
    this.server.tool(name, description, inputSchema, handler);
    
    // Track tool in connected server
    const prefix = name.split(':')[0];
    const server = Array.from(this.connectedServers.values())
      .find(s => s.config.prefix === prefix);
    
    if (server) {
      server.tools.set(name, { description, inputSchema });
    }
  }

  async start(port: number = 8080) {
    // Start HTTP server for SSE transport
    this.app.listen(port, 'localhost', () => {
      console.log(`🚀 MCP Aggregator Server running on http://localhost:${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`🔗 MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`🔐 Security: localhost-only binding (use SSH tunnel for remote access)`);
      
      const serverCount = this.connectedServers.size;
      const toolCount = Array.from(this.connectedServers.values())
        .reduce((sum, server) => sum + server.tools.size, 0);
      
      console.log(`📡 Connected servers: ${serverCount}`);
      console.log(`🛠️  Available tools: ${toolCount}`);
    });
  }

  async stop() {
    console.log('Stopping MCP Aggregator Server...');
    
    // Stop all connected servers
    for (const [name, server] of this.connectedServers) {
      if (server.process) {
        console.log(`Stopping server: ${name}`);
        server.process.kill();
      }
    }
    
    this.connectedServers.clear();
    console.log('MCP Aggregator Server stopped');
  }
}

// Start the server
const aggregator = new MCPAggregatorServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  await aggregator.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  await aggregator.stop();
  process.exit(0);
});

// Start the server
const port = parseInt(process.env.PORT || '8080');
aggregator.start(port).catch(error => {
  console.error('Failed to start MCP Aggregator Server:', error);
  process.exit(1);
});