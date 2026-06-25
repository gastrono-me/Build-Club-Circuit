"use client"

import React, { useState } from "react"
import { localReadinessReview } from "@/lib/ai/local-fallbacks"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

export function ReadinessReview() {
  const [text, setText] = useState("")
  const [result, setResult] = useState<string | null>(null)

  function handleCheck() {
    const output = localReadinessReview(text)
    setResult(output)
  }

  return (
    <Card spine="none">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
        {/* Header */}
        <div>
          <span
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.heading,
              fontWeight: fontWeight.semibold,
              color: colors.ink,
            }}
          >
            Readiness Review
          </span>
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.meta,
              color: colors.muted,
              margin: `${spacing[1]}px 0 0`,
              lineHeight: 1.4,
            }}
          >
            Paste your project write-up and get a heuristic self-check. This is a
            local rule-based scan, not a judgment from a human or AI judge.
          </p>
        </div>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste your project description, story, or DevPost draft here…"
          rows={6}
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.ink,
            background: colors.surface,
            border: `1px solid ${colors.line}`,
            borderRadius: radii.md,
            padding: `${spacing[3]}px`,
            resize: "vertical",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        {/* Button */}
        <div>
          <Button
            variant="accent"
            onClick={handleCheck}
            disabled={text.trim().length === 0}
          >
            Check readiness
          </Button>
        </div>

        {/* Result */}
        {result !== null && (
          <div
            style={{
              borderTop: `1px solid ${colors.line}`,
              paddingTop: spacing[3],
              display: "flex",
              flexDirection: "column",
              gap: spacing[2],
            }}
          >
            <span
              style={{
                fontFamily: fonts.body,
                fontSize: fontSize.heading,
                fontWeight: fontWeight.semibold,
                color: colors.ink,
              }}
            >
              Self-assessment
            </span>
            <pre
              style={{
                fontFamily: fonts.body,
                fontSize: fontSize.body,
                color: colors.ink,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {result}
            </pre>
          </div>
        )}
      </div>
    </Card>
  )
}

export default ReadinessReview
