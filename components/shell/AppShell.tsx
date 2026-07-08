"use client"

import React, { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { TopBar } from "@/components/shell/TopBar"
import { Nav } from "@/components/shell/Nav"
import { MobileTabBar } from "@/components/shell/MobileTabBar"
import { SocialProvider } from "@/components/shell/SocialProvider"
import { useProfile } from "@/lib/hooks/useProfile"

// Rendered without the app chrome. /welcome is here so the onboarding gate
// below (which only runs on chromed routes) can't bounce it back to itself.
const BARE_PATHS = ["/", "/login", "/auth/callback", "/welcome"]

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
        /* Mobile: clear the fixed bottom tab bar (+ safe area) */
        @media (max-width: 767px) {
          .vec-main {
            padding-bottom: calc(56px + env(safe-area-inset-bottom));
          }
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
      <main className="vec-main"><OnboardingGate>{children}</OnboardingGate></main>
      <MobileTabBar />
    </SocialProvider>
  )
}

/**
 * First-run guard: a signed-in builder who hasn't been through /welcome yet is
 * sent there before they see the app. Existing users were backfilled as
 * onboarded (migration 027), so only genuinely new accounts are redirected.
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useProfile()
  const router = useRouter()
  const needsOnboarding = !loading && !!profile && !profile.onboarded_at

  useEffect(() => {
    if (needsOnboarding) router.replace("/welcome")
  }, [needsOnboarding, router])

  if (needsOnboarding) return null
  return <>{children}</>
}

export default AppShell
