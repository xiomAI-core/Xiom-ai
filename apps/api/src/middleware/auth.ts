/**
 * Authentication middleware — supports Bearer JWT and X-Api-Key
 */
import type { Context, Next } from 'hono';
import { jwtVerify } from 'jose';
import bcrypt from 'bcrypt';
import { db } from '../lib/db.js';
import { apiCredentials } from '@xiom/db';
import { eq, and } from 'drizzle-orm';

const JWT_SECRET_BYTES = new TextEncoder().encode(
  process.env['JWT_SECRET'] ?? 'dev-secret-32-bytes-minimum-length-here'
);

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const apiKey = c.req.header('X-Api-Key');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET_BYTES);
      c.set('humanId', String(payload['sub'] ?? ''));
      const claims = { ...payload };
      delete claims['sub'];
      delete claims['iat'];
      delete claims['exp'];
      c.set('claims', claims);
      c.set('jwtPayload', payload as Record<string, unknown>);
      await next();
      return;
    } catch {
      return c.json({ ok: false, error: 'Invalid or expired token', code: 'UNAUTHORIZED' }, 401);
    }
  }

  if (apiKey) {
    const rawKey = apiKey.startsWith('XIOM-') ? apiKey.slice(5) : apiKey;
    try {
      const allActive = await db.select().from(apiCredentials).where(
        and(eq(apiCredentials.isActive, true))
      ).limit(500);

      const credential = await (async () => {
        for (const cred of allActive) {
          if (await bcrypt.compare(rawKey, cred.apiKeyHash)) return cred;
        }
        return null;
      })();

      if (!credential) {
        return c.json({ ok: false, error: 'Invalid API key', code: 'UNAUTHORIZED' }, 401);
      }
      if (credential.expiresAt && credential.expiresAt < new Date()) {
        return c.json({ ok: false, error: 'API key expired', code: 'UNAUTHORIZED' }, 401);
      }
      if (credential.usedToday >= credential.dailyQuota) {
        return c.json({ ok: false, error: 'Daily quota exceeded', code: 'QUOTA_EXCEEDED' }, 429);
      }
      await db.update(apiCredentials)
        .set({ usedToday: credential.usedToday + 1 })
        .where(eq(apiCredentials.id, credential.id));

      c.set('humanId', credential.humanId);
      c.set('claims', { planId: credential.planId });
      c.set('jwtPayload', { sub: credential.humanId, planId: credential.planId });
      await next();
      return;
    } catch (err) {
      return c.json({ ok: false, error: 'Authentication error', code: 'UNAUTHORIZED' }, 401);
    }
  }

  return c.json({ ok: false, error: 'Missing authentication credential', code: 'UNAUTHORIZED' }, 401);
}
