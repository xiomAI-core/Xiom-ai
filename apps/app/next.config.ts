import type { NextConfig } from 'next';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appDir, '../..');
const require = createRequire(import.meta.url);
const wagmiConnectorsRoot = path.dirname(
  require.resolve('@wagmi/connectors/package.json')
);

const apiOrigin = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ['@xiom/types', '@xiom/blockchain', '@xiom/guardian'],
  async rewrites() {
    return [
      {
        source: '/api/worldmodel/:path*',
        destination: `${apiOrigin}/api/worldmodel/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@xiom/wagmi-wallet-connect': path.join(
        wagmiConnectorsRoot,
        'dist/esm/walletConnect.js'
      ),
    };
    return config;
  },
  // typedRoutes validates that all `href` values map to real page files.
  // Disabled until /dashboard and /onboarding route files are scaffolded.
  experimental: {},
};

export default nextConfig;
