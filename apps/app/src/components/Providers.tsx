'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const ClientProviders = dynamic(
  () => import('./ClientProviders').then((mod) => mod.ClientProviders),
  { ssr: false }
);

export function Providers({ children }: { children: ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
