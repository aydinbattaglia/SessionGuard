import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'subscriptions.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    email       TEXT PRIMARY KEY NOT NULL,
    customer_id TEXT NOT NULL,
    sub_id      TEXT,
    status      TEXT NOT NULL,
    plan        TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
  )
`);

export function upsertSubscription({ email, customerId, subId, status, plan }) {
  db.prepare(`
    INSERT INTO subscriptions (email, customer_id, sub_id, status, plan, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      customer_id = excluded.customer_id,
      sub_id      = excluded.sub_id,
      status      = excluded.status,
      plan        = excluded.plan,
      updated_at  = excluded.updated_at
  `).run(email, customerId, subId ?? null, status, plan, Date.now());
}

export function getSubscription(email) {
  return db.prepare('SELECT * FROM subscriptions WHERE email = ?').get(email.toLowerCase());
}
