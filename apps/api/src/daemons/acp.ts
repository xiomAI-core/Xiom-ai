/**
 * ACP (Agent Commerce Protocol) earnings poller.
 * Interval: 5m
 */
import { revenueCache } from './revenueAccounting.js';
import { logger } from '../lib/logger.js';

export interface AcpCacheData {
  lastPollAt: string;
  jobsCompleted: number;
  earningsUsd: string;
  rawTotal: number;
}

export const acpCache: AcpCacheData = {
  lastPollAt: new Date().toISOString(),
  jobsCompleted: 0,
  earningsUsd: '0',
  rawTotal: 0,
};

interface AcpJobResponse {
  jobs?: Array<{ id?: string; status?: string; earningsUsd?: number | string }>;
  totalEarningsUsd?: number | string;
  completed?: number;
}

export async function acpDaemon(): Promise<void> {
  const baseUrl = process.env['ACP_API_URL'];
  if (!baseUrl) {
    logger.debug('acp: ACP_API_URL not set — stub tick');
    acpCache.lastPollAt = new Date().toISOString();
    return;
  }

  try {
    const url = new URL('/jobs/completed', baseUrl.replace(/\/$/, ''));
    url.searchParams.set('since', acpCache.lastPollAt);

    const headers: Record<string, string> = { Accept: 'application/json' };
    const apiKey = process.env['ACP_API_KEY'];
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'acp: poll failed');
      return;
    }

    const data = (await res.json()) as AcpJobResponse;
    const jobs = data.jobs ?? [];
    let earned = 0;
    for (const job of jobs) {
      const v = Number(job.earningsUsd ?? 0);
      if (Number.isFinite(v)) earned += v;
    }
    if (data.totalEarningsUsd !== undefined) {
      const t = Number(data.totalEarningsUsd);
      if (Number.isFinite(t)) earned = t;
    }

    acpCache.jobsCompleted += data.completed ?? jobs.length;
    acpCache.rawTotal += earned;
    acpCache.earningsUsd = acpCache.rawTotal.toFixed(2);
    acpCache.lastPollAt = new Date().toISOString();

    // Merge into revenue accounting cache
    revenueCache.acpEarnings = acpCache.earningsUsd;
    const total =
      parseFloat(revenueCache.flaunchFees || '0') + acpCache.rawTotal;
    revenueCache.totalUsdc = total.toFixed(2);
    revenueCache.totalTxns += data.completed ?? jobs.length;
    revenueCache.lastUpdatedAt = acpCache.lastPollAt;

    logger.info(
      { jobs: jobs.length, earned, total: acpCache.earningsUsd },
      'acp: earnings aggregated'
    );
  } catch (err) {
    logger.warn({ err }, 'acp: failed');
  }
}
