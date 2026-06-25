"use client"

import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { ExternalLink } from "lucide-react"
import { useSubmission } from "@/lib/hooks/useSubmission"
import { colors, fonts, fontSize, fontWeight, spacing } from "@/lib/design/tokens"

export function DevpostLink() {
  const { devpostUrl, save } = useSubmission()
  return (
    <Card>
      <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, color: colors.ink, marginBottom: spacing[2] }}>
        Your DevPost link
      </div>
      <div style={{ fontFamily: fonts.body, fontSize: fontSize.meta, color: colors.muted, marginBottom: spacing[3] }}>
        Keep it handy so you can jump straight to your submission.
      </div>
      <Input value={devpostUrl} onChange={e => save(e.target.value)} placeholder="https://devpost.com/software/your-project" />
      {devpostUrl && (
        <a href={devpostUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: spacing[3], color: colors.violet, fontFamily: fonts.mono, fontSize: fontSize.label, textDecoration: "none" }}>
          Open submission <ExternalLink size={12} />
        </a>
      )}
    </Card>
  )
}

export default DevpostLink
