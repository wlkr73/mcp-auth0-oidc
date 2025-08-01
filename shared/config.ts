import type { Auth0Config, Env } from './types';

export function getAuth0Config(env: Env): Auth0Config {
  return {
    domain: env.AUTH0_DOMAIN,
    clientId: env.AUTH0_CLIENT_ID,
    clientSecret: env.AUTH0_CLIENT_SECRET,
    audience: env.AUTH0_AUDIENCE,
    scope: env.AUTH0_SCOPE || 'openid email profile offline_access read:todos'
  };
}

export function validateAuth0Config(config: Auth0Config): void {
  const required = ['domain', 'clientId', 'clientSecret', 'audience'];
  const missing = required.filter(key => !config[key as keyof Auth0Config]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required Auth0 configuration: ${missing.join(', ')}`);
  }
}

export const API_ENDPOINTS = {
  health: '/api/health',
  me: '/api/me',
  todos: '/api/todos',
  billing: '/api/billing'
} as const;

export const MCP_TOOLS = {
  whoami: 'whoami',
  listTodos: 'list-todos',
  listBilling: 'list-billing'
} as const;