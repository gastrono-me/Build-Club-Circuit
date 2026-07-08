"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useProfile } from "@/lib/hooks/useProfile"
import { ALL_TAGS, INDUSTRIES, LOOKING } from "@/types/index"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Tag } from "@/components/ui/Tag"
import { colors, fonts, fontSize, fontWeight, radii, spacing, shadows } from "@/lib/design/tokens"

const MAX_BIO = 240

/**
 * First-run profile setup. Captures the fields that power discovery and
 * matching (what you do, skills, industries, what you're looking for) in one
 * focused screen, then drops the builder into Today. Skippable — either path
 * stamps onboarded_at so they're not sent here again.
 */
export function OnboardingView() {
  const router = useRouter()
  const { profile, loading, save } = useProfile()

  const [name, setName] = useState("")
  const [occupation, setOccupation] = useState("")
  const [org, setOrg] = useState("")
  const [skills, setSkills] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [looking, setLooking] = useState<string[]>([])
  const [bio, setBio] = useState("")
  const [busy, setBusy] = useState<"save" | "skip" | null>(null)
  const seeded = React.useRef(false)

  // Seed from the auto-created profile once (name defaults to the email prefix).
  useEffect(() => {
    if (loading || !profile || seeded.current) return
    seeded.current = true
    setName(profile.name ?? "")
    setOccupation(profile.occupation ?? "")
    setOrg(profile.org ?? "")
    setSkills(profile.skills ?? [])
    setIndustries(profile.industries ?? [])
    setLooking(profile.looking ?? [])
    setBio(profile.bio ?? "")
  }, [loading, profile])

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  async function finish(skip: boolean) {
    setBusy(skip ? "skip" : "save")
    try {
      const patch = skip
        ? { onboarded_at: new Date().toISOString() }
        : {
            name: name.trim(),
            occupation: occupation.trim(),
            org: org.trim(),
            skills,
            industries,
            looking,
            bio: bio.trim(),
            onboarded_at: new Date().toISOString(),
          }
      await save(patch as any)
      router.push("/home")
    } catch (err) {
      console.error("[onboarding] save failed:", err)
      setBusy(null)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.surface, padding: `${spacing[6]}px ${spacing[4]}px` }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        {/* Wordmark */}
        <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.bold, fontSize: fontSize.heading, color: colors.ink, marginBottom: spacing[5] }}>
          Circuit <span style={{ fontFamily: fonts.mono, fontSize: fontSize.micro, color: colors.mutedSoft, letterSpacing: "0.06em" }}>Build Club</span>
        </div>

        <h1 style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.display, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0, color: colors.ink }}>
          Welcome. Let&rsquo;s set you up.
        </h1>
        <p style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.muted, margin: `${spacing[2]}px 0 ${spacing[5]}px` }}>
          A minute now means the cohort can find you, match you, and build alongside you. You can change any of this later.
        </p>

        <div style={{ background: colors.panel, border: `1px solid ${colors.line}`, borderRadius: radii.xl, boxShadow: shadows.card, padding: spacing[5], display: "flex", flexDirection: "column", gap: spacing[4] }}>
          <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="How you want to be known" />
          <div style={{ display: "flex", gap: spacing[3], flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <Input label="What you do" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Founder, engineer, designer…" />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Input label="Company (optional)" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Where, if anywhere" />
            </div>
          </div>

          <ChipGroup label="Your skills" options={ALL_TAGS as readonly string[]} selected={skills} onToggle={(v) => toggle(skills, setSkills, v)} />
          <ChipGroup label="Industries you build in" options={INDUSTRIES as readonly string[]} selected={industries} onToggle={(v) => toggle(industries, setIndustries, v)} />
          <ChipGroup label="What you're looking for" options={LOOKING as readonly string[]} selected={looking} onToggle={(v) => toggle(looking, setLooking, v)} />

          <div>
            <FieldLabel>Short bio (optional)</FieldLabel>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
              rows={3}
              placeholder="One or two lines on what you're building and why."
              style={{ width: "100%", boxSizing: "border-box", border: `1.4px solid ${colors.line}`, borderRadius: radii.md, padding: "11px 13px", fontFamily: fonts.body, fontSize: fontSize.body, color: colors.ink, background: colors.paper2, outline: "none", resize: "vertical" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: spacing[3], marginTop: spacing[5] }}>
          <Button variant="accent" disabled={busy !== null} onClick={() => finish(false)}>
            {busy === "save" ? "Saving…" : "Save and continue"}
          </Button>
          <button
            type="button"
            onClick={() => finish(true)}
            disabled={busy !== null}
            style={{ border: "none", background: "transparent", color: colors.muted, fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.03em", cursor: "pointer" }}
          >
            {busy === "skip" ? "…" : "Skip for now"}
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.muted, marginBottom: spacing[2] }}>
      {children}
    </div>
  )
}

function ChipGroup({ label, options, selected, onToggle }: { label: string; options: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
        {options.map((o) => (
          <Tag key={o} tone="ink" active={selected.includes(o)} onClick={() => onToggle(o)}>{o}</Tag>
        ))}
      </div>
    </div>
  )
}

export default OnboardingView
