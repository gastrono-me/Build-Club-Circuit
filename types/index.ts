// ---- Session ----------------------------------------------------------------

export interface Session {
  id: string
  day: number
  start: number
  end: number
  type: string
  title: string
  venue: string
  by: string
  tags: string[]
  desc?: string
  lumaUrl?: string
}

// ---- TbaSession ---------------------------------------------------------------
// Real sessions whose date/time Luma hasn't published yet (approval-gated listings).

export interface TbaSession {
  id: string
  type: string
  title: string
  venue: string
  by: string
  tags: string[]
  desc?: string
  lumaUrl?: string
}

// ---- Day --------------------------------------------------------------------

export interface Day {
  idx: number
  label: string
  date: string
  sub: string
}

// ---- Venue ------------------------------------------------------------------

export interface Venue {
  name: string
  area: string
  main?: boolean
}

// ---- Profile ----------------------------------------------------------------

export interface Profile {
  name: string
  occupation: string
  org: string
  tagline: string
  bio: string
  skills: string[]
  industries: string[]
  looking: string[]
  links: {
    linkedin?: string
    github?: string
    x?: string
    instagram?: string
  }
  avatar_url?: string
}

// ---- Blocker ----------------------------------------------------------------

export interface Blocker {
  id: string
  personId: string
  tag: string
  note: string
}

// ---- Constants --------------------------------------------------------------

export { WORK_CATEGORIES, type WorkCategory } from '@/lib/data/work-categories'

// ---- Profile option lists (ported from legacy/App.jsx) ------------------

export const ALL_TAGS = [
  "Agents", "LLMs", "RAG", "ML", "Backend", "Frontend",
  "DevOps", "Design", "Product", "Mobile", "Data", "Networking",
] as const

export const INDUSTRIES = [
  "Fintech", "Healthcare", "Education", "Climate", "Web3", "Gaming",
  "E-commerce", "DevTools", "Enterprise", "Social Impact", "Robotics", "Consumer",
] as const

export const LOOKING = [
  "Teammate", "Co-founder", "Mentor", "Mentee", "Just networking",
] as const
