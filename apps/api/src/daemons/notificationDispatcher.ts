/**
 * Notification dispatcher — Telegram (or log stub) for pending alerts.
 * Interval: 1m
 */
import { getWmConn } from './wmConn.js';
import { logger } from '../lib/logger.js';

async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  const chatId = process.env['TELEGRAM_CHAT_ID'];
  if (!token || !chatId) {
    logger.info({ channel: 'stub', text: text.slice(0, 200) }, 'notificationDispatcher: no Telegram config');
    return false;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    logger.warn({ status: res.status }, 'notificationDispatcher: Telegram send failed');
    return false;
  }
  return true;
}

export async function notificationDispatcherDaemon(): Promise<void> {
  try {
    const conn = getWmConn();

    const [actions, proposals] = await Promise.all([
      conn.queryMany<{
        id: string;
        actionType: string;
        intent: string;
        urgency: string | null;
      }>(
        `MATCH (a:Action)
         WHERE coalesce(a.notificationPending, false) = true
            OR (a.executionStatus = 'proposed' AND coalesce(a.alert, false) = true)
         RETURN a.id AS id, a.actionType AS actionType, a.intent AS intent,
                a.urgency AS urgency
         LIMIT 50`
      ),
      conn.queryMany<{
        id: string;
        description: string;
        humanId: string;
      }>(
        `MATCH (p:PolicyProposal)
         WHERE coalesce(p.status, 'pending_review') = 'pending_review'
           AND coalesce(p.notificationSent, false) = false
         RETURN p.id AS id, p.description AS description, p.humanId AS humanId
         LIMIT 50`
      ),
    ]);

    let sent = 0;

    for (const a of actions) {
      const text =
        `[XIOM ${a.urgency ?? 'alert'}] ${a.actionType}\n${a.intent}`;
      const ok = await sendTelegram(text);
      await conn.query(
        `MATCH (a:Action {id: $id})
         SET a.notificationPending = false,
             a.notificationSentAt = $now,
             a.notificationChannel = $channel`,
        {
          id: a.id,
          now: new Date().toISOString(),
          channel: ok ? 'telegram' : 'stub',
        }
      );
      sent += 1;
    }

    for (const p of proposals) {
      const text =
        `[XIOM policy proposal] human=${p.humanId}\n${p.description ?? p.id}`;
      const ok = await sendTelegram(text);
      await conn.query(
        `MATCH (p:PolicyProposal {id: $id})
         SET p.notificationSent = true,
             p.notificationSentAt = $now,
             p.notificationChannel = $channel`,
        {
          id: p.id,
          now: new Date().toISOString(),
          channel: ok ? 'telegram' : 'stub',
        }
      );
      sent += 1;
    }

    if (sent > 0) {
      logger.info({ sent, actions: actions.length, proposals: proposals.length }, 'notificationDispatcher: tick');
    }
  } catch (err) {
    logger.warn({ err }, 'notificationDispatcher: failed');
  }
}
