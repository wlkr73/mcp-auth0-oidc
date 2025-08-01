#!/usr/bin/env node

const { spawn } = require('child_process');
const SSHTunnel = require('./ssh-tunnel');

/**
 * Claude Desktop MCP Client with SSH Tunnel
 * This script manages the SSH tunnel and provides the MCP endpoint for Claude Desktop
 */
class ClaudeMCPClient {
  constructor(config) {
    this.config = config;
    this.tunnel = null;
    this.mcpEndpoint = `http://localhost:${config.localPort}/mcp`;
  }

  async start() {
    console.log('🚀 Starting Claude MCP Client with SSH Tunnel...');

    // Create and start SSH tunnel
    this.tunnel = new SSHTunnel(this.config);
    
    // Start tunnel
    this.tunnel.start();

    // Wait for tunnel to establish
    await this.waitForTunnel();

    // Keep the process alive
    console.log('✅ MCP Client ready for Claude Desktop');
    console.log(`🔗 MCP Endpoint: ${this.mcpEndpoint}`);
    console.log('📝 Add this to your ~/.claude.json:');
    this.printClaudeConfig();

    // Keep process alive
    process.stdin.resume();
  }

  async waitForTunnel(maxAttempts = 10) {
    console.log('⏳ Waiting for SSH tunnel to establish...');
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (await this.tunnel.testConnection()) {
        console.log('✅ SSH tunnel established successfully');
        return;
      }
      
      console.log(`   Attempt ${i + 1}/${maxAttempts}...`);
    }
    
    throw new Error('Failed to establish SSH tunnel after maximum attempts');
  }

  printClaudeConfig() {
    const config = {
      mcpServers: {
        "mcp-aggregator": {
          command: "node",
          args: [
            __filename,
            this.config.localPort.toString(),
            this.config.remoteHost,
            this.config.remotePort.toString()
          ],
          env: {}
        }
      }
    };

    console.log('\n' + JSON.stringify(config, null, 2));
    console.log('\n💡 Copy the above configuration to ~/.claude.json');
  }

  stop() {
    console.log('🛑 Stopping Claude MCP Client...');
    if (this.tunnel) {
      this.tunnel.stop();
    }
  }
}

// Configuration from environment or command line
const config = {
  localPort: parseInt(process.env.LOCAL_PORT || process.argv[2] || '8080'),
  remotePort: parseInt(process.env.REMOTE_PORT || process.argv[4] || '8080'),
  remoteHost: process.env.REMOTE_HOST || process.argv[3] || 'your-hetzner-server.com',
  sshUser: process.env.SSH_USER || 'root'
};

if (require.main === module) {
  // Validate configuration
  if (!config.remoteHost || config.remoteHost === 'your-hetzner-server.com') {
    console.error('❌ Please provide your Hetzner server hostname:');
    console.error('   Usage: node claude-client.js <local-port> <remote-host> <remote-port>');
    console.error('   Example: node claude-client.js 8080 my-server.hetzner.cloud 8080');
    console.error('   Or set REMOTE_HOST environment variable');
    process.exit(1);
  }

  const client = new ClaudeMCPClient(config);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    client.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    client.stop();
    process.exit(0);
  });

  // Start the client
  client.start().catch(error => {
    console.error('❌ Failed to start Claude MCP Client:', error);
    process.exit(1);
  });
}