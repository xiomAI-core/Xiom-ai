/**
 * Daemon orchestrator — starts all background workers (in-process fleet).
 *
 * Production: Cloud Run service `xiom-api` with min-instances=1 runs this fleet.
 * Alias note: some docs/scripts historically said `axiom-api`; prefer `xiom-api`.
 */
import { logger } from '../lib/logger.js';
import { worldModelSyncDaemon } from './worldModelSync.js';
import { tokenTelemetryDaemon } from './tokenTelemetry.js';
import { bidwallMonitorDaemon } from './bidwallMonitor.js';
import { holderSnapshotDaemon } from './holderSnapshot.js';
import { revenueAccountingDaemon } from './revenueAccounting.js';
import { healthCheckDaemon } from './healthCheck.js';
import { freshnessDecayDaemon } from './freshnessDecay.js';
import { sessionJanitorDaemon } from './sessionJanitor.js';
import { intakeMetricsDaemon } from './intakeMetrics.js';
import { quotaResetDaemon } from './quotaReset.js';
import { loopSchedulerDaemon, LOOP_SCHEDULER_INTERVAL_MS } from './loopScheduler.js';
import { policyEvolutionDaemon, POLICY_EVOLUTION_INTERVAL_MS } from './policyEvolution.js';
import { contextFreshnessDaemon } from './contextFreshness.js';
import { patternDetectorDaemon } from './patternDetector.js';
import { auditVerifierDaemon } from './auditVerifier.js';
import { acpDaemon } from './acp.js';
import { notificationDispatcherDaemon } from './notificationDispatcher.js';
import { graphBackupDaemon } from './graphBackup.js';
import { activationQueueDaemon } from './activationQueue.js';
import { priceOracleDaemon } from './priceOracle.js';

export interface DaemonConfig {
  name: string;
  start: () => Promise<void>;
  intervalMs: number;
}

/** Full in-process daemon fleet (20 = core 18 + intake-metrics + quota-reset). */
export const DAEMONS: DaemonConfig[] = [
  { name: 'world-model-sync',        start: worldModelSyncDaemon,        intervalMs: 30_000 },
  { name: 'token-telemetry',         start: tokenTelemetryDaemon,        intervalMs: 60_000 },
  { name: 'bidwall-monitor',         start: bidwallMonitorDaemon,        intervalMs: 30_000 },
  { name: 'holder-snapshot',         start: holderSnapshotDaemon,        intervalMs: 6 * 60 * 60_000 },
  { name: 'revenue-accounting',      start: revenueAccountingDaemon,     intervalMs: 5 * 60_000 },
  { name: 'health-check',            start: healthCheckDaemon,           intervalMs: 10_000 },
  { name: 'freshness-decay',         start: freshnessDecayDaemon,        intervalMs: 60 * 60_000 },
  { name: 'session-janitor',         start: sessionJanitorDaemon,        intervalMs: 24 * 60 * 60_000 },
  { name: 'intake-metrics',          start: intakeMetricsDaemon,         intervalMs: 5 * 60_000 },
  { name: 'quota-reset',             start: quotaResetDaemon,            intervalMs: 24 * 60 * 60_000 },
  { name: 'loop-scheduler',          start: loopSchedulerDaemon,         intervalMs: LOOP_SCHEDULER_INTERVAL_MS },
  { name: 'policy-evolution',        start: policyEvolutionDaemon,       intervalMs: POLICY_EVOLUTION_INTERVAL_MS },
  { name: 'context-freshness',       start: contextFreshnessDaemon,      intervalMs: 2 * 60 * 60_000 },
  { name: 'pattern-detector',        start: patternDetectorDaemon,       intervalMs: 24 * 60 * 60_000 },
  { name: 'audit-verifier',          start: auditVerifierDaemon,         intervalMs: 6 * 60 * 60_000 },
  { name: 'acp',                     start: acpDaemon,                   intervalMs: 5 * 60_000 },
  { name: 'notification-dispatcher', start: notificationDispatcherDaemon,intervalMs: 60_000 },
  { name: 'graph-backup',            start: graphBackupDaemon,           intervalMs: 24 * 60 * 60_000 },
  { name: 'activation-queue',        start: activationQueueDaemon,       intervalMs: 5 * 60_000 },
  { name: 'price-oracle',            start: priceOracleDaemon,           intervalMs: 30_000 },
];

export function listDaemons(): Array<{ name: string; intervalMs: number }> {
  return DAEMONS.map(({ name, intervalMs }) => ({ name, intervalMs }));
}

export async function runDaemonOnce(name: string): Promise<boolean> {
  const daemon = DAEMONS.find((d) => d.name === name);
  if (!daemon) return false;
  await daemon.start();
  return true;
}

export async function startDaemons() {
  logger.info({ count: DAEMONS.length }, 'Starting background daemons…');

  for (const daemon of DAEMONS) {
    try {
      await daemon.start().catch((err: unknown) => {
        logger.warn({ daemon: daemon.name, err }, 'Daemon first-run failed (non-fatal)');
      });

      setInterval(() => {
        void (async () => {
          try { await daemon.start(); }
          catch (err) { logger.error({ daemon: daemon.name, err }, 'Daemon error'); }
        })();
      }, daemon.intervalMs);

      logger.info({ daemon: daemon.name, intervalMs: daemon.intervalMs }, 'Daemon registered');
    } catch (err) {
      logger.error({ daemon: daemon.name, err }, 'Failed to start daemon');
    }
  }
}
