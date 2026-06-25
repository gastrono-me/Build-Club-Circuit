const PROFILE_BASE: Record<"linkedin" | "github" | "x" | "instagram", string> = {
  linkedin: "https://linkedin.com/in/",
  github: "https://github.com/",
  x: "https://x.com/",
  instagram: "https://instagram.com/",
}

/**
 * Accepts either a bare handle ("@you" or "you") or a full profile URL and
 * normalizes to a full URL. Passes non-matching input (e.g. a link to a
 * specific LinkedIn post) through unchanged.
 */
export function normalizeSocialLink(platform: keyof typeof PROFILE_BASE, raw: string): string {
  const value = raw.trim()
  if (!value) return ""
  if (/^https?:\/\//i.test(value)) return value
  const handle = value.replace(/^@/, "")
  return PROFILE_BASE[platform] + handle
}
