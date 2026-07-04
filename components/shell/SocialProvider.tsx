"use client"

import React, { createContext, useContext, useState } from "react"
import { useCatchups, type CatchupAgendaRow } from "@/lib/hooks/useCatchups"
import { useInbox, type InboxConversation } from "@/lib/hooks/useInbox"
import { useActivity, type ActivityRow } from "@/lib/hooks/useActivity"
import { PersonPanel } from "@/components/people/PersonPanel"

export type { InboxConversation }

export interface ChatPerson {
  id: string
  name: string
  occupation?: string
  org?: string
  tags?: string[]
  industries?: string[]
  looking?: string[]
  bio?: string
  avatar?: string | null
}

interface SocialApi {
  catchups: CatchupAgendaRow[]
  /** Catchups someone proposed to me that I haven't accepted/declined yet — the catchup equivalent of an unread message. */
  pendingCatchups: CatchupAgendaRow[]
  cancelCatchup: (catchupId: string) => void
  openPanel: (p: ChatPerson, focus: "chat" | "catchup") => void
  inbox: InboxConversation[]
  totalUnread: number
  markRead: (otherId: string) => void
  /** Cheers on my own ships, newest first. */
  activity: ActivityRow[]
  /** Groups with cheers newer than my read cursor. */
  unreadActivity: number
  /** Mark all activity seen (called when the notifications surface opens). */
  markActivityRead: () => void
}

const SocialContext = createContext<SocialApi | null>(null)

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const { catchups, cancel: cancelCatchup } = useCatchups()
  const { conversations: inbox, totalUnread, markRead } = useInbox()
  const { activity, unreadActivity, markActivityRead } = useActivity()
  const [panelPerson, setPanelPerson] = useState<ChatPerson | null>(null)
  const [panelFocus, setPanelFocus] = useState<"chat" | "catchup">("chat")

  const pendingCatchups = catchups.filter(c => c.direction === "received" && c.status === "proposed")

  const api: SocialApi = {
    catchups,
    pendingCatchups,
    cancelCatchup,
    openPanel: (p, focus) => {
      if (focus === "chat") markRead(p.id)
      setPanelPerson(p)
      setPanelFocus(focus)
    },
    inbox,
    totalUnread,
    markRead,
    activity,
    unreadActivity,
    markActivityRead,
  }

  return (
    <SocialContext.Provider value={api}>
      {children}
      {panelPerson && (
        <PersonPanel
          person={panelPerson}
          focus={panelFocus}
          onClose={() => setPanelPerson(null)}
        />
      )}
    </SocialContext.Provider>
  )
}

export function useSocial(): SocialApi {
  const ctx = useContext(SocialContext)
  if (!ctx) throw new Error("useSocial must be used within a SocialProvider")
  return ctx
}
