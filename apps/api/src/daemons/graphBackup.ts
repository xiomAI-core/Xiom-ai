/**
 * Graph backup daemon — export world models to GCS (or local backups/).
 * Interval: 24h (prefers ~03:00 UTC on first eligible run)
 */
import { mkdir, writeFile, readdir, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { exportWorldModel } from '@xiom/world-model';
import { getWmConn } from './wmConn.js';
import { logger } from '../lib/logger.js';

const RETENTION_DAYS = 30;
const LOCAL_DIR = join(process.cwd(), 'backups');

let lastBackupDate: string | null = null;

function dateStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

async function uploadToGcs(
  humanId: string,
  date: string,
  body: string
): Promise<boolean> {
  const bucketName = process.env['GCS_BACKUP_BUCKET'] ?? 'xiom-backups';
  try {
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const file = storage.bucket(bucketName).file(`${humanId}/${date}.json`);
    await file.save(body, { contentType: 'application/json', resumable: false });

    // Prune older than 30 days
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: `${humanId}/` });
    const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
    for (const f of files) {
      const created = f.metadata.timeCreated
        ? Date.parse(String(f.metadata.timeCreated))
        : NaN;
      if (Number.isFinite(created) && created < cutoff) {
        await f.delete({ ignoreNotFound: true });
      }
    }
    return true;
  } catch (err) {
    logger.warn(
      { err, cmd: `gsutil cp backups/${humanId}/${date}.json gs://${bucketName}/${humanId}/${date}.json` },
      'graphBackup: GCS upload unavailable — wrote local backup'
    );
    return false;
  }
}

async function pruneLocal(humanId: string): Promise<void> {
  const dir = join(LOCAL_DIR, humanId);
  try {
    const files = await readdir(dir);
    const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
    for (const name of files) {
      if (!name.endsWith('.json')) continue;
      const path = join(dir, name);
      const s = await stat(path);
      if (s.mtimeMs < cutoff) await unlink(path);
    }
  } catch {
    // directory may not exist
  }
}

export async function graphBackupDaemon(): Promise<void> {
  const now = new Date();
  const today = dateStamp(now);

  // Prefer ~03:00 UTC; allow immediate if never backed up today
  const hour = now.getUTCHours();
  if (lastBackupDate === today && hour !== 3) {
    return;
  }
  if (lastBackupDate === today) {
    return;
  }
  // Skip early hours before 3am unless no prior backup in process lifetime
  if (lastBackupDate !== null && hour < 3) {
    return;
  }

  try {
    const conn = getWmConn();
    const humans = await conn.queryMany<{ id: string }>(
      `MATCH (h:Human) RETURN h.id AS id LIMIT 200`
    );

    if (humans.length === 0) {
      logger.debug('graphBackup: no humans');
      lastBackupDate = today;
      return;
    }

    await mkdir(LOCAL_DIR, { recursive: true });
    let backedUp = 0;

    for (const { id: humanId } of humans) {
      try {
        const snapshot = await exportWorldModel(conn, humanId);
        const body = JSON.stringify(snapshot, null, 2);
        const humanDir = join(LOCAL_DIR, humanId);
        await mkdir(humanDir, { recursive: true });
        const localPath = join(humanDir, `${today}.json`);
        await writeFile(localPath, body, 'utf8');

        await uploadToGcs(humanId, today, body);
        await pruneLocal(humanId);
        backedUp += 1;
      } catch (err) {
        logger.warn({ err, humanId }, 'graphBackup: human failed');
      }
    }

    lastBackupDate = today;
    logger.info({ backedUp, date: today }, 'graphBackup: tick');
  } catch (err) {
    logger.warn({ err }, 'graphBackup: failed');
  }
}
