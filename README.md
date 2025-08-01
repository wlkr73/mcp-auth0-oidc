# Unified Auth0 MCP Server

This is a unified project that combines an Auth0-protected API with an MCP server that provides OAuth authentication for Claude Code integration.

## Architecture

```
unified-auth0-mcp/
├── api/              # Protected Todos API (Cloudflare Worker)
├── mcp-server/       # MCP Server with Auth0 OAuth (Cloudflare Worker + Durable Object)
├── shared/           # Shared types and utilities
└── package.json      # Workspace configuration
```

## Components

### 1. Protected API (`/api`)
- **Purpose**: Serves todos data protected by Auth0 JWT tokens
- **Endpoints**: 
  - `GET /api/health` - Health check
  - `GET /api/me` - User profile from JWT claims
  - `GET /api/todos` - User's todos (requires `read:todos` scope)
  - `GET /api/billing` - User's billing info (requires `read:billing` scope)
- **Authentication**: Auth0 JWT tokens with scope validation

### 2. MCP Server (`/mcp-server`)
- **Purpose**: MCP server that handles OAuth flow and calls the protected API
- **Features**:
  - OAuth 2.0 authorization code flow with PKCE
  - Auth0 integration for user authentication
  - MCP tools that proxy API calls with user's access token
  - Durable Object for session management
- **Tools**:
  - `whoami` - Show current user's Auth0 claims
  - `list-todos` - Fetch user's todos from API
  - `list-billing` - Fetch user's billing (demonstrates scope restrictions)

## Flow

1. **Claude Code connects** to MCP server via `mcp-remote`
2. **OAuth redirect** - User authenticates via Auth0
3. **Token exchange** - MCP server gets access token
4. **API calls** - MCP tools call protected API with user's token
5. **Data returned** - API responses flow back to Claude Code

## Setup

### Prerequisites
- Auth0 tenant with configured application and API
- Cloudflare account with Workers and KV access

### Development
```bash
# Install all dependencies
npm install

# Start both services in development
npm run dev

# Start individually
npm run dev:api     # API on localhost:8789
npm run dev:mcp     # MCP on localhost:8788
```

### Deployment
```bash
# Deploy both to Cloudflare
npm run deploy

# Deploy individually  
npm run deploy:api
npm run deploy:mcp
```

### Configuration

Both services require Auth0 configuration. See individual README files in `/api` and `/mcp-server` for detailed setup instructions.

## Claude Code Integration

Add to `~/.claude.json`:
```json
{
  "mcpServers": {
    "auth0-mcp": {
      "command": "npx",
      "args": [
        "-y", 
        "mcp-remote@latest",
        "https://mcp-auth0-oidc.your-subdomain.workers.dev/sse"
      ]
    }
  }
}
```

## Security

- API protected by Auth0 JWT token validation
- OAuth 2.0 with PKCE for secure authorization flow
- Scope-based access control for different API endpoints
- Tokens stored securely in Durable Objects with KV backing