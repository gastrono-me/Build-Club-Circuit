export interface SearchablePerson {
  name?: string
  occupation?: string
  role?: string
  org?: string
  tagline?: string
  bio?: string
  [key: string]: unknown
}

/**
 * Free-text keyword search over name + occupation + role + org + tagline + bio.
 * Case-insensitive substring match. Empty query returns all people.
 * Tag/industry/skills arrays are NOT searched.
 */
export function keywordSearch<T extends SearchablePerson>(people: T[], q: string): T[] {
  if (!q || !q.trim()) return people
  const lower = q.toLowerCase()
  return people.filter((p) => {
    const haystack = [p.name, p.occupation, p.role, p.org, p.tagline, p.bio]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(lower)
  })
}
