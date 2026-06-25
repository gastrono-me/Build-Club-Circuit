import React from "react"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { colors, fonts, fontSize, fontWeight, spacing, radii } from "@/lib/design/tokens"

export function ClawbiePlaceholder() {
  return (
    <div
      style={{
        padding: `${spacing[5]}px ${spacing[4]}px`,
        maxWidth: 600,
        margin: "0 auto",
      }}
    >
      <SectionTitle
        kicker="Coming soon"
        title="Ask Clawbie"
        note="Not yet live."
      />

      <div
        style={{
          background: colors.panel,
          border: `1px solid ${colors.line}`,
          borderRadius: radii.xl,
          padding: spacing[6],
          marginBottom: spacing[4],
        }}
      >
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.ink,
            lineHeight: 1.6,
            margin: `0 0 ${spacing[4]}px`,
          }}
        >
          Clawbie is Build Club&apos;s event assistant. It answers questions about the schedule,
          venues, sessions, and speakers using data from your actual event programme.
        </p>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.muted,
            lineHeight: 1.6,
            margin: `0 0 ${spacing[4]}px`,
          }}
        >
          The assistant is being integrated by the event organiser and will be available
          before the event opens. Until then, use the Schedule and Maps pages for session
          and venue information.
        </p>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: spacing[2],
            background: colors.surface,
            border: `1px solid ${colors.line}`,
            borderRadius: radii.md,
            padding: `${spacing[2]}px ${spacing[3]}px`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: colors.mutedSoft,
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              color: colors.muted,
            }}
          >
            Offline
          </span>
        </div>
      </div>

      <div
        style={{
          background: colors.violetSoft,
          borderRadius: radii.lg,
          padding: spacing[4],
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.body,
            color: colors.violet,
            marginBottom: spacing[1],
          }}
        >
          What it will do
        </div>
        <ul
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.ink,
            lineHeight: 1.7,
            margin: 0,
            paddingLeft: spacing[4],
          }}
        >
          <li>Answer questions about sessions, timing, and locations</li>
          <li>Surface speakers and topics relevant to what you are working on</li>
          <li>Help you find the right workshop or person during the event</li>
        </ul>
      </div>
    </div>
  )
}

export default ClawbiePlaceholder
