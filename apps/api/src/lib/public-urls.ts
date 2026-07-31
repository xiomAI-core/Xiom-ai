/**
 * Public-facing URLs for provisioning capsules, install scripts, and well-known JSON.
 * Override in .env for local dev (see .env.example).
 */

const PROD_API = 'https://api.xiom-ai.com';
const PROD_APP = 'https://app.xiom-ai.com';
const PROD_MARKETING = 'https://xiom-ai.com';

export function publicApiUrl(): string {
  return process.env['PUBLIC_API_URL'] ?? PROD_API;
}

export function publicAppUrl(): string {
  return process.env['PUBLIC_APP_URL'] ?? PROD_APP;
}

export function publicMarketingUrl(): string {
  return process.env['PUBLIC_MARKETING_URL'] ?? PROD_MARKETING;
}

export function publicMcpUrl(): string {
  return `${publicApiUrl()}/mcp`;
}

export function publicWorldModelLiveUrl(): string {
  return `${publicApiUrl()}/api/worldmodel/live`;
}

export function publicApiEndpoints() {
  const api = publicApiUrl();
  return {
    api,
    mcp: `${api}/mcp`,
    worldModel: `${api}/api/worldmodel/live`,
  };
}

export function installScriptUrl(provider: string): string {
  return `${publicApiUrl()}/install/${provider}`;
}

export function pairAppUrl(code: string): string {
  return `${publicAppUrl()}/pair?code=${code}`;
}
