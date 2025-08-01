#!/usr/bin/env node

const { spawn } = require('child_process');
const process = require('process');

class SSHTunnel {
  constructor(config) {
    this.localPort = config.localPort || 8080;
    this.remotePort = config.remotePort || 8080;
    this.remoteHost = config.remoteHost;
    this.sshUser = config.sshUser;
    this.sshOptions = config.sshOptions || {};
    this.process = null;
    this.reconnectDelay = 5000; // 5 seconds
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;
  }

  start() {
    console.log(`🔗 Starting SSH tunnel: localhost:${this.localPort} -> ${this.sshUser}@${this.remoteHost}:${this.remotePort}`);
    
    const sshArgs = [
      '-L', `${this.localPort}:localhost:${this.remotePort}`,
      '-o', 'ServerAliveInterval=60',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'StrictHostKeyChecking=no',
      '-N', // Don't execute remote commands
      `${this.sshUser}@${this.remoteHost}`
    ];

    this.process = spawn('ssh', sshArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.process.stdout.on('data', (data) => {
      console.log(`SSH: ${data.toString().trim()}`);
    });

    this.process.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.error(`SSH Error: ${message}`);
      }
    });

    this.process.on('exit', (code) => {
      console.log(`SSH tunnel exited with code ${code}`);
      
      if (code !== 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay/1000}s...`);
        
        setTimeout(() => {
          this.start();
        }, this.reconnectDelay);
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached. Giving up.');
        process.exit(1);
      }
    });

    this.process.on('error', (error) => {
      console.error('SSH tunnel error:', error);
    });

    // Reset reconnect attempts on successful connection
    setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.reconnectAttempts = 0;
        console.log('✅ SSH tunnel established successfully');
        console.log(`🔒 MCP Aggregator accessible at http://localhost:${this.localPort}/mcp`);
        console.log(`📊 Health check at http://localhost:${this.localPort}/health`);
      }
    }, 2000);
  }

  stop() {
    if (this.process) {
      console.log('🔌 Closing SSH tunnel...');
      this.process.kill();
      this.process = null;
    }
  }

  async testConnection() {
    try {
      const response = await fetch(`http://localhost:${this.localPort}/health`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Tunnel connection test successful:', data.status);
        return true;
      } else {
        console.log('❌ Tunnel connection test failed:', response.status);
        return false;
      }
    } catch (error) {
      console.log('❌ Tunnel connection test error:', error.message);
      return false;
    }
  }
}

// Configuration from environment or command line
const config = {
  localPort: parseInt(process.env.LOCAL_PORT || process.argv[2] || '8080'),
  remotePort: parseInt(process.env.REMOTE_PORT || process.argv[4] || '8080'),
  remoteHost: process.env.REMOTE_HOST || process.argv[3] || 'your-hetzner-server.com',
  sshUser: process.env.SSH_USER || process.env.USER || 'root'
};

if (require.main === module) {
  // Validate configuration
  if (!config.remoteHost || config.remoteHost === 'your-hetzner-server.com') {
    console.error('❌ Please provide your Hetzner server hostname:');
    console.error('   Usage: node ssh-tunnel.js <local-port> <remote-host> <remote-port>');
    console.error('   Example: node ssh-tunnel.js 8080 my-server.hetzner.cloud 8080');
    console.error('   Or set REMOTE_HOST environment variable');
    process.exit(1);
  }

  console.log('🚀 SSH Tunnel Configuration:');
  console.log(`   Local: localhost:${config.localPort}`);
  console.log(`   Remote: ${config.sshUser}@${config.remoteHost}:${config.remotePort}`);
  console.log();

  const tunnel = new SSHTunnel(config);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, closing tunnel...');
    tunnel.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, closing tunnel...');
    tunnel.stop();
    process.exit(0);
  });

  // Start the tunnel
  tunnel.start();

  // Test connection after a delay
  setTimeout(async () => {
    await tunnel.testConnection();
  }, 5000);
}

module.exports = SSHTunnel;