import 'dotenv/config';
import { startTelemetry } from './telemetry.js';
import { serve } from '@hono/node-server';
import { app } from './app.js';
import { startDaemons } from './daemons/runner.js';
import { logger } from './lib/logger.js';

const PORT = Number(process.env['API_PORT'] ?? 3001);

async function main() {
  await startTelemetry();

  logger.info({ port: PORT, env: process.env['NODE_ENV'] }, 'Starting XIOM API');

  await startDaemons();

  serve(
    {
      fetch: app.fetch,
      port: PORT,
    },
    (info) => {
      logger.info({ url: `http://localhost:${info.port}` }, 'XIOM API ready');
    }
  );
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
