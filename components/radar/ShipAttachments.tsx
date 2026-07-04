"use client"

import React from "react"
import { Paperclip, ExternalLink } from "lucide-react"
import type { BuildLogRow } from "@/lib/hooks/useBuildLog"
import { colors, fonts, fontSize, radii, spacing } from "@/lib/design/tokens"

/** Short, readable label for a link (its hostname without www). */
function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Renders a ship's optional attachments: an uploaded image inline, any other
 * uploaded file as a download chip, and a link as a chip. Renders nothing when
 * the ship has none. Shared by the feed card and the Spotlight featured card.
 */
export function ShipAttachments({ post, compact }: { post: BuildLogRow; compact?: boolean }) {
  const isImage = !!post.media_url && (post.media_type?.startsWith("image/") ?? false)
  const hasFile = !!post.media_url && !isImage
  if (!post.media_url && !post.link_url) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[2], marginTop: spacing[3] }}>
      {isImage && (
        <a href={post.media_url!} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.media_url!}
            alt={post.media_name ?? "Ship attachment"}
            loading="lazy"
            style={{
              display: "block",
              width: "100%",
              maxHeight: compact ? 220 : 360,
              objectFit: "cover",
              borderRadius: radii.md,
              border: `1px solid ${colors.line}`,
            }}
          />
        </a>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
        {hasFile && (
          <a
            href={post.media_url!}
            target="_blank"
            rel="noopener noreferrer"
            style={chipStyle}
          >
            <Paperclip size={13} />
            <span style={chipText}>{post.media_name ?? "Attachment"}</span>
          </a>
        )}
        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            style={chipStyle}
          >
            <ExternalLink size={13} />
            <span style={chipText}>{linkLabel(post.link_url)}</span>
          </a>
        )}
      </div>
    </div>
  )
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  maxWidth: "100%",
  padding: "5px 10px",
  borderRadius: radii.pill,
  background: colors.violetSoft,
  color: colors.violet,
  fontFamily: fonts.mono,
  fontSize: fontSize.label,
  letterSpacing: "0.02em",
  textDecoration: "none",
}

const chipText: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

export default ShipAttachments
