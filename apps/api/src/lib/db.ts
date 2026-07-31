/**
 * Database client — typed Drizzle ORM instance
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from '@xiom/db';

const connectionString =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/xiom';

const sql = postgres(connectionString, { max: 10, idle_timeout: 30, connect_timeout: 10 });

export const db = drizzle(sql, { schema });

export type Db = typeof db;
