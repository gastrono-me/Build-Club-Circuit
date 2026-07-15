import { cleanFixtures, connectDb, requireEnv } from "./db.mjs"

export default async function globalTeardown() {
  const client = await connectDb()
  try {
    const { rows } = await client.query(
      "select id from auth.users where email = any($1::text[])",
      [[requireEnv("E2E_ADMIN_EMAIL"), requireEnv("E2E_BUILDER_EMAIL")]],
    )
    await cleanFixtures(client, rows.map((row) => row.id))
    console.log("Non-production E2E fixtures removed")
  } finally {
    await client.end()
  }
}
