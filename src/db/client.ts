import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Cached on globalThis so `next dev` hot reloads don't open a new pool each time.
// `max` stays small: every Vercel function instance has its own pool and Neon's free tier caps connections.
const globalForPool = globalThis as unknown as { pool?: Pool };

function pool() {
  return (globalForPool.pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));
}

export const db = () => drizzle(pool(), { casing: 'snake_case' });
