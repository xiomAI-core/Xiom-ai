/**
 * Frontend URL helpers — use env in deploy, sensible defaults for Vercel demo.
 */

const PROD_API = 'https://api.xiom-ai.com';
const PROD_APP = 'https://xiom-app.vercel.app';
const PROD_MARKETING = 'https://xiom-marketing.vercel.app';

export const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? PROD_API;

export const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? PROD_APP;

export const MARKETING_URL =
  process.env['NEXT_PUBLIC_MARKETING_URL'] ?? PROD_MARKETING;

export function apiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${normalized}`;
}

export function installScriptUrl(provider: string): string {
  return `${API_URL}/install/${provider}`;
}
