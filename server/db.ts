import pg from 'pg'

let pool: pg.Pool | undefined

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim()
    if (!connectionString) throw new Error('DATABASE_URL is not set (use your Neon Postgres connection string)')
    pool = new pg.Pool({ connectionString, max: 5 })
  }
  return pool
}

export async function query<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await getPool().query<T>(text, params)).rows
}

export async function ensureSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_name     TEXT NOT NULL,
      user_email    TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
  await query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(user_email))')
  await query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )`)
  await query(`
    CREATE TABLE IF NOT EXISTS meetings (
      meeting_id       TEXT PRIMARY KEY,
      user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      meeting_name     TEXT NOT NULL,
      meeting_password TEXT NOT NULL DEFAULT '',
      date_time        TIMESTAMPTZ NOT NULL,
      timezone         TEXT NOT NULL DEFAULT 'UTC',
      agenda           TEXT NOT NULL DEFAULT '',
      duration         INTEGER NOT NULL DEFAULT 30,
      auto_recording   BOOLEAN NOT NULL DEFAULT false,
      hold             INTEGER NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
  await query('CREATE INDEX IF NOT EXISTS meetings_user_idx ON meetings (user_id)')
}
