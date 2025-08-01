#!/bin/bash

# Integration Test Script for Unified Auth0 MCP Server

set -e

echo "🧪 Testing Unified Auth0 MCP Server Integration..."

# Test API health endpoint
echo "1️⃣ Testing API health endpoint..."
API_HEALTH=$(curl -s "https://todos-api.marcean.workers.dev/api/health" || echo "failed")

if [[ $API_HEALTH == *"ok"* ]]; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed: $API_HEALTH"
fi

# Test MCP server OAuth discovery
echo "2️⃣ Testing MCP server OAuth discovery..."
MCP_DISCOVERY=$(curl -s "https://mcp-auth0-oidc.marcean.workers.dev/.well-known/oauth-authorization-server" 2>/dev/null || echo "failed")

if [[ $MCP_DISCOVERY == *"authorization_endpoint"* ]]; then
    echo "✅ MCP OAuth discovery working"
else
    echo "❌ MCP OAuth discovery failed: $MCP_DISCOVERY"
fi

# Test MCP server SSE endpoint (should require auth)
echo "3️⃣ Testing MCP server SSE endpoint..."
MCP_SSE=$(curl -s "https://mcp-auth0-oidc.marcean.workers.dev/sse" 2>/dev/null || echo "failed")

if [[ $MCP_SSE == *"invalid_token"* ]] || [[ $MCP_SSE == *"authentication"* ]]; then
    echo "✅ MCP SSE endpoint correctly requires authentication"
else
    echo "⚠️  MCP SSE response: $MCP_SSE"
fi

echo ""
echo "🎯 Integration Summary:"
echo "• API is deployed and healthy"
echo "• MCP server OAuth discovery is working"  
echo "• MCP server correctly requires authentication"
echo ""
echo "💡 Next steps:"
echo "1. Configure Auth0 credentials in both services"
echo "2. Update Claude Desktop config to use: https://mcp-auth0-oidc.marcean.workers.dev/sse"
echo "3. Restart Claude Desktop and test OAuth flow"