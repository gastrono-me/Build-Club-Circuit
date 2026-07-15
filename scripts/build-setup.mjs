import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const root = new URL("../", import.meta.url)
const migrationsDir = new URL("db/migrations/", root)
const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort()
const sections = []

for (const file of files) {
  const sql = (await readFile(new URL(file, migrationsDir), "utf8")).trim()
  sections.push(`-- ─────────────────────────────────────────────────────────\n-- db/migrations/${file}\n-- ─────────────────────────────────────────────────────────\n${sql}`)
}

const seed = (await readFile(new URL("db/seed.sql", root), "utf8")).trim()
sections.push(`-- ─────────────────────────────────────────────────────────\n-- db/seed.sql\n-- ─────────────────────────────────────────────────────────\n${seed}`)

const header = `-- ============================================================
-- Circuit — full schema setup bundle (generated)
-- Paste into the Supabase SQL editor of a NEW project and run.
-- Idempotent: safe to re-run after adding migrations.
-- Source of truth is db/migrations/*.sql + db/seed.sql.
-- Regenerate with: npm run db:bundle
-- ============================================================`

await writeFile(new URL("db/setup_all.sql", root), `${header}\n\n\n${sections.join("\n\n\n")}\n`)
