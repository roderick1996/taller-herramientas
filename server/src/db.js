import 'dotenv/config';
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/taller',
  options: '-c timezone=America/La_Paz', // todas las fechas en hora de Bolivia
});

export const q = (text, params) => pool.query(text, params);

/** Ejecuta varias consultas como una sola transacción (todo o nada) */
export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
