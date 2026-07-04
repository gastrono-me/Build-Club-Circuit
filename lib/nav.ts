import {
  Home,
  Users,
  CalendarRange,
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
 * Whether a nav item should read as active for the current path. Matches the
 * item exactly and also its sub-routes, so detail pages (e.g. /projects/:id,
 * /events/:slug) keep their parent tab highlighted.
 */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

/**
 * Circuit's navigation, grouped by the evergreen model:
 *  - "Your build" — the daily loop (the spine): ship, projects, blockers, pitch.
 *  - "Community"  — the always-on graph plus events as first-class episodes.
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
      { label: "Events", href: "/events", Icon: CalendarRange },
    ],
  },
]
