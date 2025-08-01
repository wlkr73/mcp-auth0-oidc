#!/bin/bash

# MCP Aggregator Deployment Script for Hetzner Server

set -e  # Exit on any error

# Configuration
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-your-hetzner-server.com}"
REMOTE_PATH="${REMOTE_PATH:-/opt/mcp-aggregator}"
SERVICE_NAME="mcp-aggregator"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if REMOTE_HOST is configured
if [ "$REMOTE_HOST" = "your-hetzner-server.com" ]; then
    print_error "Please configure your Hetzner server hostname:"
    echo "  export REMOTE_HOST=your-actual-server.com"
    echo "  export REMOTE_USER=your-username  # (optional, defaults to root)"
    exit 1
fi

print_status "Starting deployment to $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

# Build the project locally
print_status "Building project locally..."
npm run build

# Create deployment package
print_status "Creating deployment package..."
tar -czf mcp-aggregator.tar.gz dist/ package.json package-lock.json config/ scripts/ ecosystem.config.js README.md

# Transfer files to server
print_status "Transferring files to server..."
scp mcp-aggregator.tar.gz "$REMOTE_USER@$REMOTE_HOST:/tmp/"

# Execute deployment on remote server
print_status "Executing deployment on remote server..."
ssh "$REMOTE_USER@$REMOTE_HOST" << EOF
set -e

# Create application directory
sudo mkdir -p $REMOTE_PATH
cd $REMOTE_PATH

# Backup existing installation
if [ -d "dist" ]; then
    echo "Backing up existing installation..."
    sudo mv dist dist.backup.\$(date +%Y%m%d_%H%M%S) || true
fi

# Extract new version
echo "Extracting new version..."
sudo tar -xzf /tmp/mcp-aggregator.tar.gz
sudo chown -R $REMOTE_USER:$REMOTE_USER .

# Install dependencies
echo "Installing dependencies..."
npm ci --production

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Set up systemd service for PM2 (auto-start on boot)
if ! systemctl is-enabled pm2-$REMOTE_USER &> /dev/null; then
    echo "Setting up PM2 systemd service..."
    pm2 startup systemd -u $REMOTE_USER --hp /home/$REMOTE_USER
    sudo systemctl enable pm2-$REMOTE_USER
fi

# Configure firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    sudo ufw allow 22/tcp    # SSH
    sudo ufw allow 8080/tcp  # MCP Aggregator (localhost only, for tunnel)
    sudo ufw --force enable
fi

# Start/restart the application
echo "Starting/restarting MCP Aggregator..."
pm2 delete $SERVICE_NAME 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# Cleanup
rm -f /tmp/mcp-aggregator.tar.gz

echo "Deployment completed successfully!"
EOF

# Cleanup local deployment package
rm -f mcp-aggregator.tar.gz

print_success "Deployment completed!"
print_status "Service status on remote server:"

# Check service status
ssh "$REMOTE_USER@$REMOTE_HOST" "pm2 status $SERVICE_NAME"

print_success "MCP Aggregator deployed successfully!"
echo
print_status "Next steps:"
echo "  1. Set up SSH tunnel: npm run tunnel"
echo "  2. Test connection: curl http://localhost:8080/health"
echo "  3. Configure Claude Desktop with: http://localhost:8080/mcp"
echo
print_status "Remote server commands:"
echo "  View logs: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs $SERVICE_NAME'"
echo "  Restart:   ssh $REMOTE_USER@$REMOTE_HOST 'pm2 restart $SERVICE_NAME'"
echo "  Stop:      ssh $REMOTE_USER@$REMOTE_HOST 'pm2 stop $SERVICE_NAME'"