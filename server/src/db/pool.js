const { Pool } = require('pg');

function resolveSsl() {
  const raw = (process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'require') {
    return { rejectUnauthorized: false };
  }

  return false;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(),
});

pool.on('error', (err) => {
  console.error('Unexpected pg client error', err);
  process.exit(-1);
});

module.exports = pool;
