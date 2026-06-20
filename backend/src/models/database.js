const { Pool } = require('pg');

let pool = null;

function getDbPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://submarine:submarine_pass@localhost:5432/submarine_depths'
    });
  }
  return pool;
}

async function query(text, params) {
  const pool = getDbPool();
  const result = await pool.query(text, params);
  return result;
}

async function initDb() {
  try {
    await query('SELECT 1');
    console.log('Database connected successfully');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    throw err;
  }
}

module.exports = { query, initDb, getDbPool };
