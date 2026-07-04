#!/usr/bin/env node
/**
 * Apply pending SQL migrations to a Postgres (Supabase) database.
 *
 * Runs every file in db/migrations/*.sql that has not been applied yet, in
 * filename order, each inside its own transaction, and records it in a
 * public._migrations table so it is only ever applied once. Existing
 * migrations are written idempotently, so a first run against a database that
 * already has them is safe (it just records them as applied).
 *
 * Usage:
 *   SUPABASE_DB_URL="postgres://…" node scripts/migrate.mjs           # apply pending
 *   SUPABASE_DB_URL="postgres://…" node scripts/migrate.mjs baseline 013
 *   npm run db:migrate
 *
 * `baseline <N>` records migrations 001..N as applied WITHOUT running them.
 * Run it once against a database that already has those migrations (applied by
 * hand before this tooling existed), so the runner never tries to replay them.
 * Replaying is not safe in general: a later migration can evolve a table an
 * earlier one indexes, so re-running the earlier one against the evolved schema
 * fails. Baselining records history without touching the schema.
 *
 * The connection string is the Supabase Postgres URL
 * (Dashboard -> Project Settings -> Database -> Connection string). In CI it is
 * provided by the SUPABASE_DB_URL secret.
 */
import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations")

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error(
    "SUPABASE_DB_URL is not set.\n" +
      "Set it to your Supabase Postgres connection string, e.g.\n" +
      '  SUPABASE_DB_URL="postgres://postgres:…@…supabase.com:5432/postgres" npm run db:migrate',
  )
  process.exit(1)
}

// Supabase requires SSL; skip verification for the local case only.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url)
const ssl = isLocal ? false : { rejectUnauthorized: false }

/**
 * Connect with a few retries. Supabase's connection pooler occasionally rejects
 * or drops the first attempt (transient "password authentication failed" /
 * timeouts) even with correct credentials, so one blip should not fail a deploy.
 * A genuinely wrong credential still fails every attempt and surfaces the error.
 */
async function connect(attempts = 4) {
  let lastErr
  for (let i = 1; i <= attempts; i++) {
    const c = new pg.Client({ connectionString: url, ssl, connectionTimeoutMillis: 15000 })
    try {
      await c.connect()
      return c
    } catch (err) {
      lastErr = err
      await c.end().catch(() => {})
      if (i < attempts) {
        console.error(`connect attempt ${i}/${attempts} failed (${err.message}); retrying…`)
        await new Promise((r) => setTimeout(r, 1500 * i))
      }
    }
  }
  throw lastErr
}

async function main() {
  const client = await connect()
  try {
    await run(client)
  } finally {
    await client.end().catch(() => {})
  }
}

async function run(client) {
  await client.query(`
    create table if not exists public._migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const applied = new Set(
    (await client.query("select name from public._migrations")).rows.map((r) => r.name),
  )

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort()

  // baseline mode: record 001..N as applied without executing them.
  if (process.argv[2] === "baseline") {
    const ceiling = process.argv[3] ? parseInt(process.argv[3], 10) : Infinity
    if (process.argv[3] && Number.isNaN(ceiling)) throw new Error(`baseline needs a number, got "${process.argv[3]}"`)
    const mark = files.filter((f) => parseInt(f, 10) <= ceiling)
    for (const file of mark) {
      await client.query("insert into public._migrations(name) values ($1) on conflict (name) do nothing", [file])
    }
    console.log(`Baselined ${mark.length} migration(s) as applied (through ${ceiling === Infinity ? "latest" : ceiling}). None were executed.`)
    return
  }

  // Guard: a database that already has schema but no migration history must be
  // baselined first, or we would dangerously replay old migrations onto an
  // evolved schema. A genuinely fresh database (no profiles table) proceeds.
  if (applied.size === 0) {
    const { rows } = await client.query("select to_regclass('public.profiles') as t")
    if (rows[0].t !== null) {
      throw new Error(
        "This database already has schema but no migration history.\n" +
          "Baseline the already-applied migrations first, e.g.\n" +
          "  node scripts/migrate.mjs baseline <highest-applied-number>\n" +
          "(In CI: run the 'migrate' workflow manually with the baseline input set.)",
      )
    }
  }

  const pending = files.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    console.log(`Up to date — ${files.length} migration(s) already applied.`)
    return
  }

  console.log(`Applying ${pending.length} pending migration(s):`)
  for (const file of pending) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8")
    process.stdout.write(`  • ${file} … `)
    try {
      await client.query("begin")
      await client.query(sql)
      await client.query("insert into public._migrations(name) values ($1)", [file])
      await client.query("commit")
      console.log("ok")
    } catch (err) {
      await client.query("rollback").catch(() => {})
      console.log("failed")
      throw err
    }
  }
  console.log("Done.")
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message)
  process.exitCode = 1
})
