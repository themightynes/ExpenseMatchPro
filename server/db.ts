import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

// Lazy initialization - only create pool when actually used (not during build)
let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool() {
  if (!_pool) {
    // Debug: log available env vars
    console.log('[DB] DATABASE_URL present:', !!process.env.DATABASE_URL);
    console.log('[DB] NODE_ENV:', process.env.NODE_ENV);
    console.log('[DB] Env keys with DATABASE or PORT:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('PORT')));

    if (!process.env.DATABASE_URL) {
      console.error('[DB] All environment variables:', Object.keys(process.env));
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Railway requires SSL
      }
    });
  }
  return _pool;
}

export const pool = new Proxy({} as pg.Pool, {
  get(target, prop) {
    return (getPool() as any)[prop];
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    if (!_db) {
      _db = drizzle(getPool(), { schema });
    }
    return (_db as any)[prop];
  }
});