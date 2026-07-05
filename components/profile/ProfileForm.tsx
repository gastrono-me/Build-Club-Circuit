"use client"

import React, { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/lib/hooks/useProfile"
import { normalizeSocialLink } from "@/lib/social"
import type { Profile } from "@/types/index"
import { ALL_TAGS, INDUSTRIES, LOOKING } from "@/types/index"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Tag } from "@/components/ui/Tag"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/shell/Avatar"
import {
  colors, fonts, fontSize, spacing, radii, motion,
} from "@/lib/design/tokens"

const MAX_BIO = 200
const MAX_AVATAR_PX = 320

async function resizeImageFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const scale = Math.min(1, MAX_AVATAR_PX / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.88 })
}

type SaveState = "idle" | "saving" | "saved" | "error"

function ChipGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  function toggle(opt: string) {
    onChange(
      selected.includes(opt)
        ? selected.filter(s => s !== opt)
        : [...selected, opt]
    )
  }
  return (
    <div>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.label,
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          color: colors.muted,
          marginBottom: spacing[2],
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: spacing[2] }}>
        {options.map(opt => (
          <Tag key={opt} active={selected.includes(opt)} onClick={() => toggle(opt)}>
            {opt}
          </Tag>
        ))}
      </div>
    </div>
  )
}

export function ProfileForm() {
  const { profile, loading, save } = useProfile()

  const [name, setName] = useState("")
  const [occupation, setOccupation] = useState("")
  const [org, setOrg] = useState("")
  const [tagline, setTagline] = useState("")
  const [bio, setBio] = useState("")
  const [skills, setSkills] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [looking, setLooking] = useState<string[]>([])
  const [linkedin, setLinkedin] = useState("")
  const [github, setGithub] = useState("")
  const [x, setX] = useState("")
  const [instagram, setInstagram] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>()
  const [avatarUploadTime, setAvatarUploadTime] = useState<number>(0)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const fileRef = useRef<HTMLInputElement>(null)

  // Populate form once profile loads
  useEffect(() => {
    if (!profile) return
    setName(profile.name ?? "")
    setOccupation(profile.occupation ?? "")
    setOrg(profile.org ?? "")
    setTagline(profile.tagline ?? "")
    setBio(profile.bio ?? "")
    setSkills(profile.skills ?? [])
    setIndustries(profile.industries ?? [])
    setLooking(profile.looking ?? [])
    setLinkedin(profile.links?.linkedin ?? "")
    setGithub(profile.links?.github ?? "")
    setX(profile.links?.x ?? "")
    setInstagram(profile.links?.instagram ?? "")
    setAvatarUrl(profile.avatar_url)
  }, [profile])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const blob = await resizeImageFile(file)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const path = `${user.id}/avatar.jpg`
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" })
      if (error) throw error
      const { data } = supabase.storage.from("avatars").getPublicUrl(path)
      const cleanUrl = data.publicUrl
      // Store clean URL in state and DB immediately
      setAvatarUrl(cleanUrl)
      setAvatarUploadTime(Date.now())
      // Persist to DB right away without waiting for Save button
      await save({ avatar_url: cleanUrl })
    } catch (err) {
      console.error("Avatar upload failed:", err)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveState("saving")
    const normalizedLinkedin = normalizeSocialLink("linkedin", linkedin)
    const normalizedGithub = normalizeSocialLink("github", github)
    const normalizedX = normalizeSocialLink("x", x)
    const normalizedInstagram = normalizeSocialLink("instagram", instagram)
    const patch: Partial<Profile> = {
      name,
      occupation,
      org,
      tagline,
      bio: bio.slice(0, MAX_BIO),
      skills,
      industries,
      looking,
      links: { linkedin: normalizedLinkedin, github: normalizedGithub, x: normalizedX, instagram: normalizedInstagram },
      // Note: avatar_url is already saved on upload, don't override it here
      ...(avatarUrl && { avatar_url: avatarUrl }),
    }
    try {
      await save(patch)
      setLinkedin(normalizedLinkedin)
      setGithub(normalizedGithub)
      setX(normalizedX)
      setInstagram(normalizedInstagram)
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2500)
    } catch {
      setSaveState("error")
    }
  }

  if (loading) {
    return (
      <div style={{ padding: spacing[8], textAlign: "center", color: colors.muted, fontFamily: fonts.body }}>
        Loading…
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing[5] }}>

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[4] }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: radii.lg }}
          aria-label="Change avatar"
        >
          <Avatar name={name || "?"} photo={avatarUrl ? `${avatarUrl}?t=${avatarUploadTime}` : undefined} size={64} />
        </button>
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            Change photo
          </Button>
          <p style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.mutedSoft, margin: `${spacing[1]}px 0 0` }}>
            JPG, PNG, or WebP. Max 320 x 320 px after resize.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleAvatarChange}
        />
      </div>

      {/* Basic fields */}
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          <Input label="Role / Occupation" value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="e.g. Frontend Engineer" />
          <Input label="Organisation" value={org} onChange={e => setOrg(e.target.value)} placeholder="Company, indie, etc." />
          <Input label="Tagline" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="One-liner" />
          <div>
            <label style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  color: colors.muted,
                  marginBottom: spacing[2],
                }}
              >
                Bio
              </span>
              <div
                style={{
                  background: colors.panel,
                  border: `1px solid ${colors.line}`,
                  borderRadius: radii.md,
                  overflow: "hidden",
                  transition: `border-color ${motion.fast} ${motion.ease}`,
                }}
                onFocusCapture={e => { e.currentTarget.style.borderColor = colors.violet }}
                onBlurCapture={e => { e.currentTarget.style.borderColor = colors.line }}
              >
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value.slice(0, MAX_BIO))}
                  rows={3}
                  placeholder="A short bio visible to other builders"
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontFamily: fonts.body,
                    fontSize: fontSize.body,
                    color: colors.ink,
                    padding: "11px 13px",
                    resize: "vertical" as const,
                    boxSizing: "border-box" as const,
                  }}
                />
              </div>
            </label>
            <div
              style={{
                textAlign: "right" as const,
                fontFamily: fonts.mono,
                fontSize: fontSize.micro,
                color: bio.length >= MAX_BIO ? colors.live : colors.mutedSoft,
                marginTop: spacing[1],
              }}
            >
              {bio.length} / {MAX_BIO}
            </div>
          </div>
        </div>
      </Card>

      {/* Chips */}
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
          <ChipGroup label="Skills & interests" options={ALL_TAGS} selected={skills} onChange={setSkills} />
          <ChipGroup label="Industries" options={INDUSTRIES} selected={industries} onChange={setIndustries} />
          <ChipGroup label="Looking for" options={LOOKING} selected={looking} onChange={setLooking} />
        </div>
      </Card>

      {/* Social links */}
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
          <Input label="LinkedIn" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="@you or full link" />
          <Input label="GitHub" value={github} onChange={e => setGithub(e.target.value)} placeholder="@you or full link" />
          <Input label="X / Twitter" value={x} onChange={e => setX(e.target.value)} placeholder="@you or full link" />
          <Input label="Instagram" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@you or full link" />
        </div>
      </Card>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
        <Button type="submit" variant="accent" disabled={saveState === "saving"}>
          {saveState === "saving" ? "Saving…" : "Save profile"}
        </Button>
        {saveState === "saved" && (
          <span style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.go }}>
            Saved
          </span>
        )}
        {saveState === "error" && (
          <span style={{ fontFamily: fonts.body, fontSize: fontSize.body, color: colors.live }}>
            Save failed. Try again.
          </span>
        )}
      </div>
    </form>
  )
}

export default ProfileForm
