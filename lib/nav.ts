import {
  Home,
  Users,
  CalendarRange,
  Compass,
  FolderGit2,
  Shield,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  Icon: LucideIcon
  /** Only rendered for staff (a row in public.admins). */
  adminOnly?: boolean
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
 *  - "Your build" — the daily loop (the spine): ship today, projects.
 *  - "Community"  — the always-on graph: browse everyone's ships + blockers,
 *    people, and events.
 *
 * Today is strictly today (ship + get unstuck); Explore is the archive where
 * all past ships and blockers live, browsable. Everything is always listed
 * (no mode gate) so nothing is hidden.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Your build",
    items: [
      { label: "Today", href: "/home", Icon: Home },
      { label: "Projects", href: "/projects", Icon: FolderGit2 },
    ],
  },
  {
    label: "Community",
    items: [
      { label: "Explore", href: "/explore", Icon: Compass },
      { label: "People", href: "/people", Icon: Users },
      { label: "Events", href: "/events", Icon: CalendarRange },
      { label: "Admin", href: "/admin", Icon: Shield, adminOnly: true },
    ],
  },
]
