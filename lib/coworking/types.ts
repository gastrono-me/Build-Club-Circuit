export const COWORKING_GOALS = [
  "Deep work",
  "Feedback",
  "Networking",
  "Collaboration",
  "Open",
] as const

export type CoworkingGoal = (typeof COWORKING_GOALS)[number]

export const HUDDLE_KINDS = [
  "Discussion",
  "Presentation",
  "Asking for help",
  "Networking",
] as const

export type HuddleKind = (typeof HUDDLE_KINDS)[number]
export type HuddleStatus = "scheduled" | "live" | "ended" | "cancelled"

export interface FocusItem {
  id: string
  checkin_id: string
  owner_id: string
  title: string
  position: number
  completed_at: string | null
  created_at: string
}

export interface EventCheckin {
  id: string
  event_id: string
  user_id: string
  project_id: string | null
  goal: CoworkingGoal
  intention: string
  checked_in_at: string
  checked_out_at: string | null
  updated_at: string
  profile_name: string
  profile_avatar: string | null
  profile_occupation: string | null
  profile_skills: string[]
  profile_industries: string[]
  profile_looking: string[]
  project_name: string | null
  project_stage: string | null
  focus_items: FocusItem[]
}

export interface EventSpace {
  id: string
  event_id: string
  name: string
  description: string | null
  capacity: number | null
  created_at: string
}

export interface Huddle {
  id: string
  event_id: string
  space_id: string | null
  host_id: string
  topic: string
  kind: HuddleKind
  welcome_skills: string[]
  welcome_industries: string[]
  starts_at: string
  ends_at: string
  status: HuddleStatus
  created_at: string
  host_name: string
  host_avatar: string | null
  space_name: string | null
  participant_ids: string[]
}

export interface EventDemo {
  id: string
  event_id: string
  user_id: string
  post_id: string
  status: "queued" | "presented" | "skipped"
  queued_at: string
  presented_at: string | null
  builder_name: string
  builder_avatar: string | null
  ship_note: string
  ship_kind: string
  project_name: string | null
}

export interface EventNotification {
  id: string
  event_id: string
  recipient_id: string
  kind: string
  title: string
  body: string
  huddle_id: string | null
  created_at: string
  read_at: string | null
  event_slug?: string | null
}
