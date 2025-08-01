# MCP Gateway

An OpenRouter API-authenticated MCP gateway that provides unified access to multiple public MCP servers and Claude models for Claude Code and Claude Desktop integration.

## Architecture

```
mcp-gateway/
├── src/              # MCP Gateway source code
├── shared/           # Shared types and utilities  
└── package.json      # Single package configuration
```

## Purpose

This MCP Gateway serves as a **unified authenticated entry point** to multiple public MCP servers and Claude models via OpenRouter, allowing Claude Code/Desktop users to:

- **OpenRouter Integration**: Access 400+ AI models including Claude 3.5 Sonnet and Claude 4 via OpenRouter API
- **Cost-Effective**: Pay-per-use model instead of multiple AI subscriptions
- **Unified Interface**: Access tools from multiple MCP servers through one connection
- **Public Server Access**: Connect to GitHub, filesystem, web search, and other public MCP servers
- **Tool Aggregation**: All tools available in one place with prefixed names to avoid conflicts

## Connected Public MCP Servers

### 1. GitHub MCP Server
- **Tools**: Repository operations, issues, pull requests, code search
- **Prefix**: `github:` (e.g., `github:search-repositories`)
- **Authentication**: Uses your OpenRouter API key

### 2. Filesystem MCP Server  
- **Tools**: File operations, directory browsing, file content management
- **Prefix**: `fs:` (e.g., `fs:read-file`)
- **Authentication**: Secure file access within allowed paths

### 3. Web Search MCP Server
- **Tools**: Web search, content retrieval, information gathering
- **Prefix**: `web:` (e.g., `web:search`)
- **Authentication**: Rate-limited per API key

## Gateway Tools

- **`whoami`** - Show current user's OpenRouter API authentication status
- **`list-servers`** - List all connected public MCP servers
- **`github:*`** - All GitHub MCP server tools (proxied)
- **`fs:*`** - All filesystem MCP server tools (proxied)  
- **`web:*`** - All web search MCP server tools (proxied)

## Flow

1. **Claude Code connects** to MCP Gateway with OpenRouter API key
2. **API Authentication** - Gateway validates OpenRouter API key
3. **Model Access** - Direct access to 400+ models via OpenRouter
4. **Tool calls** - Gateway proxies tool calls to appropriate public MCP servers
5. **Responses aggregated** - Responses from public servers and OpenRouter flow back to Claude Code

## Setup

### Prerequisites
- OpenRouter API key from https://openrouter.ai/keys
- Cloudflare account with Workers access

### Development
```bash
# Install dependencies
npm install

# Start gateway in development
npm run dev     # Gateway on localhost:8788
```

### Deployment
```bash
# Deploy gateway to Cloudflare
npx wrangler deploy

# Set OpenRouter API key as secret
npx wrangler secret put OPENROUTER_API_KEY
```

### OpenRouter Configuration

1. Create an account at https://openrouter.ai
2. Generate an API key at https://openrouter.ai/keys
3. Load credits to your account (starts around $10 minimum)
4. Set the API key in your Cloudflare Worker secrets

## Claude Code Integration

### Option 1: Direct Integration
Add to `~/.claude.json`:
```json
{
  "mcpServers": {
    "mcp-gateway": {
      "command": "node",
      "args": [
        "/Users/adam/Projects/MCP Server/openrouter-mcp-client.js",
        "https://mcp-gateway.marcean.workers.dev",
        "YOUR_OPENROUTER_API_KEY_HERE"
      ]
    }
  }
}
```

### Option 2: Environment Variable
Store your API key in environment:
```bash
export OPENROUTER_API_KEY="your-key-here"
```

Then use in `~/.claude.json`:
```json
{
  "mcpServers": {
    "mcp-gateway": {
      "command": "node",
      "args": [
        "/Users/adam/Projects/MCP Server/openrouter-mcp-client.js",
        "https://mcp-gateway.marcean.workers.dev"
      ],
      "env": {
        "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}"
      }
    }
  }
}
```

## Testing

Test the connection:
```bash
# Basic connection test
node test-openrouter-connection.js

# Full test with API key
node openrouter-mcp-client.js https://mcp-gateway.marcean.workers.dev YOUR_API_KEY
```

## Security

- API protected by OpenRouter API key authentication
- CORS configured for secure browser access
- Environment variables stored as Cloudflare Worker secrets
- Rate limiting through OpenRouter's built-in limits

## Cost Comparison

**Traditional Subscriptions:**
- Claude Pro: $20/month
- ChatGPT Plus: $20/month
- Other AI subscriptions: $10-50/month each
- **Total: $50-100+/month**

**OpenRouter Alternative:**
- Pay per actual usage
- Typical usage: $10-25 lasting 3-6 months
- Access to 400+ models including latest Claude versions
- **Estimated: $2-8/month for typical usage**