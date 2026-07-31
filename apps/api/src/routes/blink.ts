/**
 * Blink routes — Solana Actions (Blink protocol)
 */
import { Hono } from 'hono';
import type { BlinkActionResponse } from '../types/api.js';

export const blinkRoute = new Hono();

blinkRoute.get('/guardrail', (c) => {
  const response: BlinkActionResponse = {
    title: 'XIOM Guardrail Check',
    icon: 'https://xiom-ai.com/icon.png',
    description: 'Run a constitutional guardrail policy check via XIOM',
    label: 'Check Action',
    links: {
      actions: [
        {
          label: 'Check Policy',
          href: '/blink/guardrail/check?action={action}',
          parameters: [
            { name: 'action', label: 'Action to evaluate', required: true },
          ],
        },
      ],
    },
  };
  return c.json(response);
});

blinkRoute.get('/worldmodel', (c) => {
  const response: BlinkActionResponse = {
    title: 'XIOM World Model Query',
    icon: 'https://xiom-ai.com/icon.png',
    description: 'Query the XIOM knowledge graph world model',
    label: 'Query Graph',
    links: {
      actions: [
        {
          label: 'Search',
          href: '/blink/worldmodel/search?query={query}',
          parameters: [
            { name: 'query', label: 'Search query', required: true },
          ],
        },
      ],
    },
  };
  return c.json(response);
});
