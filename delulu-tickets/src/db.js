import fs from 'node:fs';

// Money is stored in paise (₹1 = 100) so there is never any rounding.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,           -- booking reference, e.g. DLK3M9QXA2
  access_token        TEXT NOT NULL UNIQUE,       -- secret in the pass link /p/<token>
  name                TEXT NOT NULL,
  phone               TEXT NOT NULL,
  email               TEXT NOT NULL DEFAULT '',
  amount              INTEGER NOT NULL,           -- paise
  status              TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | refunded
  source              TEXT NOT NULL DEFAULT 'online',  -- online | door | comp
  provider_order_id   TEXT UNIQUE,                -- Razorpay order_xxx
  provider_payment_id TEXT,                       -- Razorpay pay_xxx
  note                TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  email_sent_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
  order_id   TEXT NOT NULL REFERENCES orders (id),
  pass_id    TEXT NOT NULL,
  pass_name  TEXT NOT NULL,
  unit_price INTEGER NOT NULL,                    -- paise, frozen at purchase time
  qty        INTEGER NOT NULL,
  PRIMARY KEY (order_id, pass_id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id          TEXT PRIMARY KEY,                   -- 8 chars, shown as DL-XXXX-XXXX
  order_id    TEXT NOT NULL REFERENCES orders (id),
  pass_id     TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  seq         INTEGER NOT NULL,                   -- 1..n within the order
  status      TEXT NOT NULL DEFAULT 'active',     -- active | void
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_order_idx ON tickets (order_id);

-- One row per thing handed out per ticket: 'entry', 'food', 'sticks'...
-- The primary key is what makes "ALREADY USED" impossible to get wrong,
-- even with five gates scanning at once.
CREATE TABLE IF NOT EXISTS redemptions (
  ticket_id TEXT NOT NULL REFERENCES tickets (id),
  kind      TEXT NOT NULL,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  gate      TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (ticket_id, kind)
);

CREATE TABLE IF NOT EXISTS scan_log (
  id        BIGSERIAL PRIMARY KEY,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ticket_id TEXT,
  kind      TEXT NOT NULL,
  result    TEXT NOT NULL,                        -- valid | used | invalid | not_included
  gate      TEXT NOT NULL DEFAULT '',
  detail    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS scan_log_at_idx ON scan_log (at DESC);
`;

function wrap(runner) {
  return {
    query: (text, params) => runner.query(text, params),
    exec: (text) => (runner.exec ? runner.exec(text) : runner.query(text)),
  };
}

/**
 * Opens the database.
 *  - DATABASE_URL set → real Postgres (Supabase, Neon, Railway, your own server).
 *  - otherwise        → PGlite: the same Postgres engine running inside Node,
 *                       saved to ./data/db. Zero setup, good for one server.
 */
export async function openDb(cfg) {
  if (cfg.databaseUrl) {
    const { default: pg } = await import('pg');
    const url = new URL(cfg.databaseUrl);
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const sslMode = cfg.databaseSsl || url.searchParams.get('sslmode') || (isLocal ? 'disable' : 'require');
    // Hosted Postgres (Supabase etc.) uses certificates Node does not know about,
    // so we encrypt but do not pin the CA. The URL's sslmode would override this.
    url.searchParams.delete('sslmode');
    const pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
      // Serverless: many short-lived copies of the app, so each keeps a single connection.
      max: cfg.serverless ? 1 : 5,
      idleTimeoutMillis: cfg.serverless ? 5000 : 10000,
    });
    pool.on('error', (err) => console.error('[db] idle client error:', err.message));
    return {
      kind: 'postgres',
      ...wrap(pool),
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(wrap(client));
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  if (cfg.dataDir !== 'memory://') fs.mkdirSync(cfg.dataDir, { recursive: true });
  const db = new PGlite(cfg.dataDir);
  await db.waitReady;
  return {
    kind: 'pglite',
    ...wrap(db),
    tx: (fn) => db.transaction((t) => fn(wrap(t))),
    close: () => db.close(),
  };
}

export async function migrate(db) {
  // The lock stops two app instances booting at once from tripping over each other.
  await db.tx(async (q) => {
    await q.query('SELECT pg_advisory_xact_lock(727000)');
    await q.exec(SCHEMA);
  });
}

/** Secrets live in the database so they survive restarts and redeploys with no setup. */
export async function getOrCreateSecret(db, key, make) {
  await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, make()]);
  const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0].value;
}
