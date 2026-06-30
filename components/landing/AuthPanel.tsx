"use client"

import React, { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { colors, spacing, fonts, fontSize, fontWeight, radii, shadows, letterSpacing } from "@/lib/design/tokens"

type State = "idle" | "sending" | "sent" | "error"

/**
 * The sign-in reveal for the landing page. Same auth logic as the old standalone
 * login (magic link + optional OAuth), presented as a dismissable modal so the
 * landing can stay visual until someone chooses to start.
 */
export function AuthPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<State>("idle")
  const [oauthMsg, setOauthMsg] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    // Focus the email field once the panel is up.
    const t = setTimeout(() => emailRef.current?.focus(), 60)
    return () => { document.removeEventListener("keydown", onKey); clearTimeout(t) }
  }, [open, onClose])

  if (!open) return null

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setState("sending")
    setOauthMsg(null)
    const supabase = createClient()
    const emailRedirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })
    setState(error ? "error" : "sent")
  }

  async function handleOAuth(provider: "google" | "github") {
    setOauthMsg(null)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
    if (error) {
      setOauthMsg(`${provider === "google" ? "Google" : "GitHub"} sign-in isn't enabled yet. Use the email link above.`)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Circuit"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(20,20,60,0.34)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing[4],
        animation: "authFade 0.18s ease-out",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 408,
          background: colors.surface,
          border: `1.5px solid ${colors.ink}`,
          borderRadius: radii.xl,
          boxShadow: shadows.modal,
          padding: spacing[5],
          position: "relative",
          animation: "authRise 0.22s cubic-bezier(0.2,0,0,1)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "inline-flex",
            padding: 6,
            border: "none",
            background: "transparent",
            color: colors.muted,
            cursor: "pointer",
            borderRadius: radii.sm,
          }}
        >
          <X size={16} />
        </button>

        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: fontSize.label,
            letterSpacing: letterSpacing.label,
            textTransform: "uppercase",
            color: colors.violet,
            marginBottom: spacing[2],
          }}
        >
          Circuit · Build Club
        </div>

        {state === "sent" ? (
          <div style={{ padding: `${spacing[2]}px 0 ${spacing[3]}px` }}>
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: fontWeight.semibold,
                fontSize: fontSize.title,
                letterSpacing: letterSpacing.display,
                color: colors.go,
                marginBottom: spacing[2],
              }}
            >
              Check your email
            </div>
            <p style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.muted, margin: 0, lineHeight: 1.5 }}>
              We sent a sign-in link to <strong style={{ color: colors.ink }}>{email}</strong>. Click it to start shipping.
            </p>
          </div>
        ) : (
          <>
            <h2
              style={{
                fontFamily: fonts.display,
                fontWeight: fontWeight.semibold,
                fontSize: fontSize.title,
                letterSpacing: letterSpacing.display,
                color: colors.ink,
                margin: `0 0 4px`,
              }}
            >
              Start shipping
            </h2>
            <p style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, margin: `0 0 ${spacing[4]}px` }}>
              Enter your email for a magic link. No password needed.
            </p>

            <form onSubmit={handleMagicLink} style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
              <Input
                ref={emailRef}
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              {state === "error" && (
                <p style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.live, margin: 0 }}>
                  Something went wrong. Try again.
                </p>
              )}
              <Button type="submit" variant="accent" full disabled={state === "sending" || !email}>
                {state === "sending" ? "Sending…" : "Send magic link"}
              </Button>
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: spacing[3], margin: `${spacing[4]}px 0` }}>
              <div style={{ flex: 1, height: 1, background: colors.line }} />
              <span style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.mutedSoft }}>OR</span>
              <div style={{ flex: 1, height: 1, background: colors.line }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
              <Button variant="secondary" full onClick={() => handleOAuth("google")}>Continue with Google</Button>
              <Button variant="secondary" full onClick={() => handleOAuth("github")}>Continue with GitHub</Button>
            </div>

            {oauthMsg && (
              <p style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, marginTop: spacing[3], textAlign: "center" }}>
                {oauthMsg}
              </p>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes authFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes authRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}

export default AuthPanel
