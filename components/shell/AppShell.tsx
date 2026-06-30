"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { TopBar } from "@/components/shell/TopBar"
import { Nav } from "@/components/shell/Nav"
import { SocialProvider } from "@/components/shell/SocialProvider"

const BARE_PATHS = ["/", "/login", "/auth/callback"]

function isBare(pathname: string): boolean {
  return BARE_PATHS.some(p => pathname === p || (p !== "/" && pathname.startsWith(p + "/")))
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (isBare(pathname)) {
    return <>{children}</>
  }

  return (
    <SocialProvider>
      <style>{`
        .vec-main {
          padding-top: 52px;
          min-height: 100vh;
        }
        /* Desktop: offset left for nav rail */
        @media (min-width: 768px) {
          .vec-main {
            margin-left: 200px;
          }
        }
      `}</style>
      <TopBar />
      <Nav />
      <main className="vec-main">{children}</main>
    </SocialProvider>
  )
}

export default AppShell
