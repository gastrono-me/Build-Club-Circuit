import pg from "pg"

export const MAIN_SLUG = "e2e-live-coworking"
export const CAPACITY_SLUG = "e2e-capacity-race"
export const FIXTURE_SLUGS = [MAIN_SLUG, CAPACITY_SLUG]
export const SHIP_PREFIX = "E2E ship:"

export function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for non-production E2E`)
  return value
}

export async function connectDb() {
  const connectionString = requireEnv("SUPABASE_DB_URL")
  const expectedRef = requireEnv("E2E_SUPABASE_PROJECT_REF")
  const parsed = new URL(connectionString)
  const targetIdentity = `${parsed.username}@${parsed.hostname}`
  if (!targetIdentity.includes(expectedRef)) {
    throw new Error(`Refusing E2E database target that does not match ${expectedRef}`)
  }
  const local = /^(localhost|127\.0\.0\.1)$/.test(parsed.hostname)
  const client = new pg.Client({ connectionString, ssl: local ? false : { rejectUnauthorized: false } })
  await client.connect()
  return client
}

export async function cleanFixtures(client, userIds = []) {
  await client.query(
    `update public.event_checkins
       set checked_out_at = coalesce(checked_out_at, now()), updated_at = now()
     where event_id in (select id from public.events where slug = any($1::text[]))`,
    [FIXTURE_SLUGS],
  )
  await client.query(
    `delete from public.event_members
     where event_id in (select id from public.events where slug = any($1::text[]))`,
    [FIXTURE_SLUGS],
  )
  await client.query("delete from public.events where slug = any($1::text[])", [FIXTURE_SLUGS])
  if (userIds.length) {
    await client.query(
      "delete from public.build_log where author_id = any($1::uuid[]) and note like $2",
      [userIds, `${SHIP_PREFIX}%`],
    )
  }
}
