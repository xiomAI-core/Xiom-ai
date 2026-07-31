/**
 * Shared drizzle-like chain mocks for Hono app.request() tests.
 */
import { vi } from 'vitest';

type Thenable<T> = Promise<T> & Record<string, unknown>;

export function thenable<T>(value: T): Thenable<T> {
  const p = Promise.resolve(value) as Thenable<T>;
  return p;
}

/** Build a thenable query chain that resolves to `value` when awaited. */
export function queryChain<T>(value: T) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain['from'] = vi.fn(self);
  chain['where'] = vi.fn(self);
  chain['limit'] = vi.fn(() => thenable(value));
  chain['orderBy'] = vi.fn(self);
  chain['groupBy'] = vi.fn(() => thenable(value));
  chain['set'] = vi.fn(self);
  chain['values'] = vi.fn(() => thenable(undefined));
  chain['returning'] = vi.fn(() => thenable(Array.isArray(value) ? value : [value]));
  // Allow `await db.select()...` and `await db.update()...where()`
  Object.assign(chain, {
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  });
  return chain;
}

export function insertChain<T>(returningRows: T[]) {
  const chain: Record<string, unknown> = {};
  chain['values'] = vi.fn(() => {
    const mid: Record<string, unknown> = {
      returning: vi.fn(() => thenable(returningRows)),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(undefined).then(resolve, reject),
    };
    return mid;
  });
  return chain;
}

export const mockVerifyUsdgPayment = vi.fn();

export const mockDb = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
};

export function resetMockDb() {
  mockDb.insert.mockReset();
  mockDb.select.mockReset();
  mockDb.update.mockReset();
  mockVerifyUsdgPayment.mockReset();
}
