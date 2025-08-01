// Shared types between API and MCP server

export interface Todo {
  id: string;
  title: string;
  description: string;
  owner: string;
  date: Date;
  completed?: boolean;
}

export interface TodosResponse {
  todos: Todo[];
}

export interface BillingInfo {
  plan: string;
  usage: number;
  limit: number;
  billing_cycle: string;
}

export interface BillingResponse {
  billing: BillingInfo;
}

export interface UserProfile {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: any;
}

export interface ApiError {
  error: string;
  message: string;
  status: number;
}

// Auth0 Configuration
export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  scope: string;
}

// Environment interface
export interface Env {
  // Auth0 Configuration
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_AUDIENCE: string;
  AUTH0_SCOPE: string;
  
  // API Configuration
  API_BASE_URL: string;
  NODE_ENV: string;
  
  // Cloudflare Bindings
  OAUTH_KV?: KVNamespace;
  MCP_OBJECT?: DurableObjectNamespace;
  AI?: any;
}