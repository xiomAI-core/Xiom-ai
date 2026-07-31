/**
 * OpenTelemetry bootstrap for xiom-api (OTLP → Grafana Cloud / GCP collector).
 *
 * Env:
 *   OTEL_EXPORTER_OTLP_ENDPOINT — e.g. https://otlp-gateway-prod-…/otlp
 *   OTEL_SERVICE_NAME           — defaults to xiom-api
 *   OTEL_SDK_DISABLED=true      — no-op mode
 */
import { metrics, trace, type Counter, type UpDownCounter, type Tracer } from '@opentelemetry/api';
import { logger } from './lib/logger.js';

const SERVICE_NAME = process.env['OTEL_SERVICE_NAME'] ?? 'xiom-api';

let started = false;
let lastWorldModelNodes = 0;

export const tracer: Tracer = trace.getTracer(SERVICE_NAME);

const meter = metrics.getMeter(SERVICE_NAME);

export const guardianDenials: Counter = meter.createCounter('guardian.denials', {
  description: 'Guardian policy denials',
});

export const worldModelNodeCount: UpDownCounter = meter.createUpDownCounter(
  'world_model.node_count',
  { description: 'Cached world-model node count' }
);

export const intakeRegistrations: Counter = meter.createCounter('intake.registrations', {
  description: 'Intake registrations',
});

export const paymentClaims: Counter = meter.createCounter('payment.claims', {
  description: 'Agent-access payment claims',
});

/** Record absolute node count as a delta against the previous observation. */
export function recordWorldModelNodeCount(absolute: number): void {
  const delta = absolute - lastWorldModelNodes;
  if (delta !== 0) worldModelNodeCount.add(delta);
  lastWorldModelNodes = absolute;
}

export async function startTelemetry(): Promise<void> {
  if (started) return;
  started = true;

  if (process.env['OTEL_SDK_DISABLED'] === 'true') {
    logger.info('telemetry: OTEL_SDK_DISABLED — shim only');
    return;
  }

  try {
    const [
      { NodeSDK },
      { Resource },
      semconv,
      { OTLPTraceExporter },
      { HttpInstrumentation },
      { PinoInstrumentation },
    ] = await Promise.all([
      import('@opentelemetry/sdk-node'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/semantic-conventions'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/instrumentation-http'),
      import('@opentelemetry/instrumentation-pino'),
    ]);

    const serviceKey =
      ('ATTR_SERVICE_NAME' in semconv
        ? (semconv as { ATTR_SERVICE_NAME: string }).ATTR_SERVICE_NAME
        : (semconv as { SEMRESATTRS_SERVICE_NAME?: string }).SEMRESATTRS_SERVICE_NAME) ??
      'service.name';

    const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    const exporterOpts = endpoint
      ? { url: `${endpoint.replace(/\/$/, '')}/v1/traces` }
      : {};
    const traceExporter = new OTLPTraceExporter(exporterOpts);

    const sdk = new NodeSDK({
      resource: new Resource({
        [serviceKey]: SERVICE_NAME,
        'service.namespace': 'xiom',
        'deployment.environment': process.env['NODE_ENV'] ?? 'development',
      }),
      traceExporter,
      instrumentations: [
        new HttpInstrumentation(),
        new PinoInstrumentation(),
      ],
    });

    await sdk.start();
    logger.info(
      { service: SERVICE_NAME, endpoint: endpoint ?? 'default-otlp' },
      'telemetry: OpenTelemetry started'
    );

    const shutdown = async () => {
      try {
        await sdk.shutdown();
      } catch (err) {
        logger.warn({ err }, 'telemetry: shutdown error');
      }
    };
    process.once('SIGTERM', () => { void shutdown(); });
    process.once('SIGINT', () => { void shutdown(); });
  } catch (err) {
    logger.warn(
      { err },
      'telemetry: failed to start NodeSDK — continuing with API-only metrics/tracer stubs'
    );
  }
}
