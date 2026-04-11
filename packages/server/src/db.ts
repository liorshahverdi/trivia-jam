import pg from 'pg';

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;

  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}
