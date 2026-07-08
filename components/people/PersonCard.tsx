"use client"

import React from "react"
import { Linkedin, Github, Twitter, Instagram, ExternalLink, MessageCircle, CalendarDays, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { Tag } from "@/components/ui/Tag"
import { Button } from "@/components/ui/Button"
import { IconButtonWithTooltip } from "@/components/ui/IconButtonWithTooltip"
import { Avatar } from "@/components/shell/Avatar"
import { matchScore } from "@/lib/match"
import { useSocial } from "@/components/shell/SocialProvider"
import { PersonButton } from "@/components/shell/PersonButton"
import type { Profile } from "@/types/index"
import {
  colors, fonts, fontSize, fontWeight, spacing, radii,
} from "@/lib/design/tokens"

/** Caps a chip row at `max` and folds the rest into a "+N" overflow chip, so card heights stay even. */
function capped(list: string[], max = 3): { shown: string[]; extra: number } {
  if (list.length <= max) return { shown: list, extra: 0 }
  return { shown: list.slice(0, max), extra: list.length - max }
}

export interface NormalizedPerson {
  id: string
  name: string
  occupation: string
  tags: string[]
  industries: string[]
  looking: string[]
  bio: string
  tagline?: string
  links?: {
    linkedin?: string
    github?: string
    x?: string
    instagram?: string
  }
  handle?: string
  avatar?: string | null
  isReal: boolean
}

interface PersonCardProps {
  person: NormalizedPerson
  me: Profile | null
  reason?: string
  /** Render as the signed-in user's own card: no Message/Catchup actions, a "You" tag instead. */
  isSelf?: boolean
}

export function PersonCard({ person, me, reason, isSelf }: PersonCardProps) {
  const meForMatch = me
    ? { tags: me.skills, industries: me.industries, looking: me.looking }
    : null
  const personForMatch = {
    tags: person.tags,
    industries: person.industries,
    looking: person.looking,
  }
  const { shared } = matchScore(meForMatch, personForMatch)

  const { openPanel, catchups } = useSocial()
  const hasCatchup = catchups.some(c => c.otherId === person.id)
  const chatPerson = {
    id: person.id, name: person.name, occupation: person.occupation,
    tags: person.tags, industries: person.industries, looking: person.looking,
    bio: person.bio, avatar: person.avatar,
  }

  const socialLinks: { href: string; label: string; icon: React.ReactNode }[] = []

  if (person.links?.linkedin) {
    socialLinks.push({
      href: person.links.linkedin,
      label: "LinkedIn",
      icon: <Linkedin size={14} />,
    })
  }
  if (person.links?.github) {
    socialLinks.push({
      href: person.links.github,
      label: "GitHub",
      icon: <Github size={14} />,
    })
  }
  const xHref = person.links?.x
    ?? (person.handle ? `https://x.com/${person.handle.replace(/^@/, "")}` : undefined)
  if (xHref) {
    socialLinks.push({
      href: xHref,
      label: "X / Twitter",
      icon: <Twitter size={14} />,
    })
  }
  if (person.links?.instagram) {
    socialLinks.push({
      href: person.links.instagram,
      label: "Instagram",
      icon: <Instagram size={14} />,
    })
  }

  return (
    <Card spine={person.isReal ? "violet" : "none"}>
      {/* Top row: avatar + name + occupation — opens the profile popup */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: spacing[3], marginBottom: spacing[3] }}>
        <PersonButton person={{ id: person.id, name: person.name, avatar: person.avatar }} style={{ gap: spacing[3], flex: 1, minWidth: 0, alignItems: "flex-start" }}>
        <Avatar name={person.name} photo={person.avatar} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: fonts.body,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.heading,
              color: colors.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {person.name}
          </div>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.meta,
              color: colors.muted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: 2,
            }}
          >
            {person.occupation}
          </div>
        </div>
        </PersonButton>
      </div>

      {/* Skill tags — capped so cards with very different tag counts stay roughly the same height */}
      {person.tags.length > 0 && (() => {
        const { shown, extra } = capped(person.tags)
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[1], marginBottom: spacing[2] }}>
            {shown.map(tag => (
              <Tag key={tag} tone="ink">{tag}</Tag>
            ))}
            {extra > 0 && <Tag tone="ink">+{extra}</Tag>}
          </div>
        )
      })()}

      {/* Looking chips */}
      {person.looking.length > 0 && (() => {
        const { shown, extra } = capped(person.looking)
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[1], marginBottom: spacing[2] }}>
            {shown.map(l => (
              <Tag key={l} tone="go">{l}</Tag>
            ))}
            {extra > 0 && <Tag tone="go">+{extra}</Tag>}
          </div>
        )
      })()}

      {/* Self badge */}
      {isSelf && (
        <div style={{ marginBottom: spacing[2] }}>
          <Tag tone="ink">You</Tag>
        </div>
      )}

      {/* Shared overlap badge */}
      {!isSelf && shared.length > 0 && (
        <div style={{ marginBottom: spacing[2] }}>
          <Tag tone="violet">{shared.length} shared</Tag>
        </div>
      )}

      {/* AI match reason badge */}
      {reason && (
        <div style={{ background: colors.violetSoft, borderRadius: radii.md, padding: "8px 11px", marginBottom: spacing[2], fontSize: fontSize.meta, color: colors.violet, display: "flex", gap: 7 }}>
          <Sparkles size={14} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{reason}</span>
        </div>
      )}

      {/* Social links */}
      {socialLinks.length > 0 && (
        <div style={{ display: "flex", gap: spacing[2], marginBottom: spacing[3], flexWrap: "wrap" }}>
          {socialLinks.map(({ href, label, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: colors.muted,
                textDecoration: "none",
                fontFamily: fonts.mono,
                fontSize: fontSize.label,
                padding: "4px 6px",
                borderRadius: 6,
                transition: "color 120ms ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = colors.violet }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = colors.muted }}
            >
              {icon}
              <ExternalLink size={10} />
            </a>
          ))}
        </div>
      )}

      {/* Action row: Message is the primary action; Catchup is an icon-only secondary action */}
      {!isSelf && (
        <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
          <Button variant="accent" size="sm" full
            icon={<MessageCircle size={14} />}
            onClick={() => openPanel(chatPerson, "chat")}>
            Message
          </Button>
          <IconButtonWithTooltip
            tooltip={hasCatchup ? "Catchup booked" : "Schedule catchup"}
            ariaLabel={hasCatchup ? `Catchup with ${person.name} booked` : `Schedule a catchup with ${person.name}`}
            active={hasCatchup}
            size={32}
            tooltipPosition="top"
            onClick={() => openPanel(chatPerson, "catchup")}
          >
            <CalendarDays size={15} />
          </IconButtonWithTooltip>
        </div>
      )}
    </Card>
  )
}

export default PersonCard
