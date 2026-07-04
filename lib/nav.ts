import {
  Home,
  Compass,
  Users,
  Map,
  Calendar,
  CalendarRange,
  MessageCircle,
  Clock,
  Activity,
  Mic,
  FolderGit2,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  Icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Circuit's navigation, grouped by the evergreen model rather than one event's
 * two halves:
 *  - "Your build"  — the daily solo loop (the spine).
 *  - "Community"   — the always-on graph: who's building, what's stuck.
 *  - "At an event" — events as first-class episodes (browse/join), plus the
 *                    episode-scoped surfaces (schedule/maps/deadline) that light
 *                    up during a live event.
 *
 * Everything is always listed (no mode gate) so nothing is hidden.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Your build",
    items: [
      { label: "Today", href: "/home", Icon: Home },
      { label: "Projects", href: "/projects", Icon: FolderGit2 },
      { label: "Radar", href: "/radar", Icon: Activity },
      { label: "Pitch Coach", href: "/pitch", Icon: Mic },
    ],
  },
  {
    label: "Community",
    items: [
      { label: "People", href: "/people", Icon: Users },
      { label: "Discover", href: "/discover", Icon: Compass },
      { label: "Ask Clawbie", href: "/clawbie", Icon: MessageCircle },
    ],
  },
  {
    label: "At an event",
    items: [
      { label: "Events", href: "/events", Icon: CalendarRange },
      { label: "Schedule", href: "/schedule", Icon: Calendar },
      { label: "Maps", href: "/maps", Icon: Map },
      { label: "Deadline", href: "/deadline", Icon: Clock },
    ],
  },
]
