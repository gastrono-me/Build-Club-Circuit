"use client"

import React, { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { colors, spacing, fonts, fontSize, fontWeight } from "@/lib/design/tokens"

type State = "idle" | "sending" | "sent" | "error"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<State>("idle")
  const [oauthMsg, setOauthMsg] = useState<string | null>(null)

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setState("sending")
    setOauthMsg(null)
    const supabase = createClient()
    const emailRedirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    })
    setState(error ? "error" : "sent")
  }

  async function handleOAuth(provider: "google" | "github") {
    setOauthMsg(null)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    if (error) {
      setOauthMsg(
        `${provider === "google" ? "Google" : "GitHub"} sign-in isn't enabled yet. Use the email link above.`
      )
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.surface,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing[4],
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <SectionTitle
          kicker="Circuit · Build Club"
          title="Sign in"
          note="Use your email to get a magic link, no password needed."
        />

        <Card spine="violet" style={{ marginTop: spacing[4] }}>
          {state === "sent" ? (
            <div style={{ textAlign: "center", padding: `${spacing[4]}px 0` }}>
              <div
                style={{
                  fontFamily: fonts.display,
                  fontWeight: fontWeight.semibold,
                  fontSize: fontSize.heading,
                  color: colors.go,
                  marginBottom: spacing[2],
                }}
              >
                Check your email
              </div>
              <p style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.muted, margin: 0 }}>
                We sent a sign-in link to <strong>{email}</strong>. Click it to continue.
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
              {state === "error" && (
                <p style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.live, margin: 0 }}>
                  Something went wrong. Try again.
                </p>
              )}
              <Button
                type="submit"
                variant="accent"
                full
                disabled={state === "sending" || !email}
              >
                {state === "sending" ? "Sending…" : "Send magic link"}
              </Button>
            </form>
          )}
        </Card>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[3],
            margin: `${spacing[4]}px 0`,
          }}
        >
          <div style={{ flex: 1, height: 1, background: colors.line }} />
          <span style={{ fontFamily: fonts.mono, fontSize: fontSize.label, color: colors.mutedSoft }}>
            OR
          </span>
          <div style={{ flex: 1, height: 1, background: colors.line }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
          <Button variant="secondary" full onClick={() => handleOAuth("google")}>
            Continue with Google
          </Button>
          <Button variant="secondary" full onClick={() => handleOAuth("github")}>
            Continue with GitHub
          </Button>
        </div>

        {oauthMsg && (
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.meta,
              color: colors.muted,
              marginTop: spacing[3],
              textAlign: "center",
            }}
          >
            {oauthMsg}
          </p>
        )}
      </div>
    </div>
  )
}
