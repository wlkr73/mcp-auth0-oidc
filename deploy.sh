#!/bin/bash

# Unified Auth0 MCP Server Deployment Script

set -e

echo "🚀 Deploying Unified Auth0 MCP Server..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the unified-auth0-mcp directory"
    exit 1
fi

# Check environment variables
required_vars=("AUTH0_DOMAIN" "AUTH0_CLIENT_ID" "AUTH0_CLIENT_SECRET" "AUTH0_AUDIENCE")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var environment variable is required"
        echo "💡 Tip: Create a .env file or set environment variables"
        exit 1
    fi
done

echo "1️⃣ Deploying Todos API..."
cd api
npm run deploy
API_URL=$(npx wrangler deployments list --limit 1 --json | jq -r '.[0].deployment_trigger.metadata.source.url // "https://todos-api.YOUR_SUBDOMAIN.workers.dev"')
echo "✅ API deployed to: $API_URL"
cd ..

echo "2️⃣ Setting API_BASE_URL for MCP server..."
cd mcp-server
npx wrangler secret put API_BASE_URL <<< "$API_URL"

echo "3️⃣ Deploying MCP Server..."
npm run deploy
MCP_URL=$(npx wrangler deployments list --limit 1 --json | jq -r '.[0].deployment_trigger.metadata.source.url // "https://mcp-auth0-oidc.YOUR_SUBDOMAIN.workers.dev"')
echo "✅ MCP Server deployed to: $MCP_URL"
cd ..

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Add this callback URL to your Auth0 app: $MCP_URL/callback"
echo "2. Update your Claude Desktop config:"
echo ""
echo "   \"mcpServers\": {"
echo "     \"auth0-mcp\": {"
echo "       \"command\": \"npx\","
echo "       \"args\": [\"-y\", \"mcp-remote@latest\", \"$MCP_URL/sse\"]"
echo "     }"
echo "   }"
echo ""
echo "3. Restart Claude Desktop and run /mcp to connect!"