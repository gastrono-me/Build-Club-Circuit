import { CAPACITY_SLUG, MAIN_SLUG, cleanFixtures, connectDb, requireEnv } from "./db.mjs"

export default async function globalSetup() {
  const adminEmail = requireEnv("E2E_ADMIN_EMAIL")
  const builderEmail = requireEnv("E2E_BUILDER_EMAIL")
  const client = await connectDb()

  try {
    const { rows } = await client.query(
      "select id, email from auth.users where email = any($1::text[])",
      [[adminEmail, builderEmail]],
    )
    const byEmail = new Map(rows.map((row) => [row.email, row.id]))
    const adminId = byEmail.get(adminEmail)
    const builderId = byEmail.get(builderEmail)
    if (!adminId || !builderId) throw new Error("Both E2E auth users must exist in non-production")

    await client.query("begin")
    await cleanFixtures(client, [adminId, builderId])
    await client.query(
      `update public.profiles
       set name = case when id = $1 then 'E2E Staff Admin' else 'E2E Builder' end,
           occupation = case when id = $1 then 'Build Club Staff' else 'Product Builder' end,
           skills = case when id = $1 then array['Community']::text[] else array['Product']::text[] end,
           industries = array['Developer Tools']::text[],
           looking = array['Collaboration']::text[],
           onboarded_at = coalesce(onboarded_at, now()),
           updated_at = now()
       where id = any($3::uuid[])`,
      [adminId, builderId, [adminId, builderId]],
    )
    await client.query("insert into public.admins(user_id) values ($1) on conflict (user_id) do nothing", [adminId])
    await client.query("delete from public.admins where user_id = $1", [builderId])

    const now = Date.now()
    const startsAt = new Date(now - 60 * 60_000)
    const endsAt = new Date(now + 4 * 60 * 60_000)
    const { rows: events } = await client.query(
      `insert into public.events(slug, name, tagline, location, capacity, starts_at, ends_at, created_by)
       values
         ($1, 'E2E Live Coworking', 'Automated non-production release gate', 'Non-production', 2, $3, $4, $5),
         ($2, 'E2E Capacity Race', 'Concurrency release gate', 'Non-production', 1, $3, $4, $5)
       returning id, slug`,
      [MAIN_SLUG, CAPACITY_SLUG, startsAt, endsAt, adminId],
    )
    const mainEvent = events.find((event) => event.slug === MAIN_SLUG)
    await client.query(
      "insert into public.event_spaces(event_id, name, description, capacity) values ($1, 'E2E Focus Room', 'One-seat capacity fixture', 1)",
      [mainEvent.id],
    )
    await client.query("commit")
    console.log("Non-production E2E fixtures ready")
  } catch (error) {
    await client.query("rollback").catch(() => {})
    throw error
  } finally {
    await client.end()
  }
}
