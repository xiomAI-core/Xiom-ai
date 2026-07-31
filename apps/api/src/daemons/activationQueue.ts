/**
 * Activation queue — auto-approve pending_review intakes with valid fields.
 * Interval: 5m
 */
import { eq } from 'drizzle-orm';
import { intakes } from '@xiom/db';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function notifyTelegram(text: string): Promise<void> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  const chatId = process.env['TELEGRAM_CHAT_ID'];
  if (!token || !chatId) {
    logger.info({ text: text.slice(0, 200) }, 'activationQueue: notify stub');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.warn({ err }, 'activationQueue: Telegram notify failed');
  }
}

export async function activationQueueDaemon(): Promise<void> {
  try {
    const pending = await db
      .select()
      .from(intakes)
      .where(eq(intakes.status, 'pending_review'))
      .limit(100);

    // Also pick up legacy 'pending' rows that look complete
    const legacy = await db
      .select()
      .from(intakes)
      .where(eq(intakes.status, 'pending'))
      .limit(50);

    const candidates = [...pending, ...legacy];
    if (candidates.length === 0) {
      logger.debug('activationQueue: empty');
      return;
    }

    let approved = 0;

    for (const row of candidates) {
      const email = row.email ?? '';
      const useCase = (row.useCase ?? '').trim();
      const consent = row.consentGiven === true;

      if (!EMAIL_RE.test(email) || useCase.length < 3 || !consent) {
        continue;
      }

      const now = new Date();
      await db
        .update(intakes)
        .set({
          status: 'approved',
          activatedAt: now,
        })
        .where(eq(intakes.id, row.id));

      await notifyTelegram(
        `[XIOM intake approved] ${row.id}\nlane=${row.lane}\nemail=${email}\nuseCase=${useCase.slice(0, 120)}`
      );
      approved += 1;
    }

    if (approved > 0) {
      logger.info({ approved, scanned: candidates.length }, 'activationQueue: tick');
    }
  } catch (err) {
    logger.warn({ err }, 'activationQueue: failed');
  }
}
