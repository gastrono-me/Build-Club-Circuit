"use client"

import React from "react"
import { useSocial, type ChatPerson } from "@/components/shell/SocialProvider"

/**
 * Wraps any person representation (an avatar, a name, or both) so clicking it
 * opens that builder's profile popup. Renders an unstyled inline button that
 * inherits the child's layout — drop it around existing avatar/name markup
 * without restyling. Use everywhere a person appears.
 */
export function PersonButton({
  person,
  focus = "profile",
  children,
  style,
  title,
}: {
  person: ChatPerson
  focus?: "profile" | "chat" | "catchup"
  children: React.ReactNode
  style?: React.CSSProperties
  title?: string
}) {
  const { openPanel } = useSocial()
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openPanel(person, focus) }}
      title={title ?? `View ${person.name}'s profile`}
      aria-label={`View ${person.name}'s profile`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "inherit",
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        font: "inherit",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export default PersonButton
