import type { Browser, BrowserContext, Page } from "@playwright/test"

export type E2ERole = "ADMIN" | "BUILDER"

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for non-production E2E`)
  return value
}

export async function authenticatedPage(browser: Browser, role: E2ERole, viewport?: { width: number; height: number }): Promise<{ context: BrowserContext; page: Page }> {
  const supabaseUrl = required("E2E_SUPABASE_URL")
  const anonKey = required("E2E_SUPABASE_ANON_KEY")
  const email = required(`E2E_${role}_EMAIL`)
  const password = required(`E2E_${role}_PASSWORD`)
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const session = await response.json()
  if (!response.ok || !session.access_token) throw new Error(`${role} E2E sign-in failed: ${session.error_description ?? session.msg ?? response.status}`)

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const encoded = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`
  const chunks = encoded.match(/.{1,3180}/g) ?? []
  const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000"
  const context = await browser.newContext({ viewport })
  await context.addCookies(chunks.map((value, index) => ({
    name: chunks.length === 1 ? cookieName : `${cookieName}.${index}`,
    value,
    url: baseURL,
    sameSite: "Lax" as const,
    expires: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  })))
  return { context, page: await context.newPage() }
}
