"use client"

import { useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Tag } from "@/components/ui/Tag"
import { localAnswer, type LocalAnswerCtx } from "@/lib/ai/local-fallbacks"
import { useEventData } from "@/lib/data/useEventData"
import { useSimClock } from "@/lib/hooks/useSimClock"
import { useSavedSchedule } from "@/lib/hooks/useSavedSchedule"
import { useProfile } from "@/lib/hooks/useProfile"
import { useSocial } from "@/components/shell/SocialProvider"
import { createClient } from "@/lib/supabase/client"
import { colors, radii, fontSize } from "@/lib/design/tokens"

interface Msg { role: "user" | "assistant"; text: string }

interface ProfileRow {
  id: string
  name: string | null
  occupation: string | null
  bio: string | null
  skills: string[] | null
  industries: string[] | null
  looking: string[] | null
}

export function ClawbieChat() {
  const { sessions, days, venues } = useEventData()
  const { day, mins } = useSimClock()
  const { saved } = useSavedSchedule()
  const { profile } = useProfile()
  const { catchups } = useSocial()
  const [realPeople, setRealPeople] = useState<ProfileRow[]>([])
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hi there. I can see the full programme, the people here, and your schedule. Ask me what is on now, what to do with a free hour, or who to meet." },
  ])
  const [input, setInput] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs])

  useEffect(() => {
    async function fetchPeople() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from("profiles").select("id, name, occupation, bio, skills, industries, looking")
      if (data) {
        const rows = (data as ProfileRow[]).filter(p => p.id !== user?.id)
        setRealPeople(rows)
      }
    }
    fetchPeople()
  }, [])

  const quick = ["What's happening right now?", "Plan my free time today", "Who should I meet?", "What's the best path to Demo Day?"]

  function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q) return
    setInput("")
    setMsgs(m => [...m, { role: "user", text: q }])
    const me = profile
      ? { tags: profile.skills, industries: profile.industries, looking: profile.looking }
      : { tags: [], industries: [], looking: [] }
    const ctx: LocalAnswerCtx = {
      attendees: realPeople.map(p => ({ id: p.id, name: p.name ?? "", occupation: p.occupation ?? "", bio: p.bio ?? "", tags: p.skills ?? [], industries: p.industries ?? [], looking: p.looking ?? [] })),
      sessions: sessions.map(s => ({ id: s.id, day: s.day, start: s.start, end: s.end, title: s.title, venue: s.venue, tags: s.tags })),
      days: days.map(d => ({ idx: d.idx, label: d.label, date: d.date })),
      venues,
      schedule: saved,
      catchups: catchups.filter(c => c.status === "accepted").map(c => ({ id: c.id, day: c.day, start: c.start_min, end: c.end_min, personId: c.otherId })),
      currentDay: day,
      currentMins: mins,
    }
    const answer = localAnswer(me, ctx, q)
    setMsgs(m => [...m, { role: "assistant", text: answer }])
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)", maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <SectionTitle kicker="Your event copilot" title="Ask Clawbie" />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 4 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "82%", padding: "11px 14px", borderRadius: 14, fontSize: fontSize.body, lineHeight: 1.5, background: m.role === "user" ? colors.ink : colors.surface, color: m.role === "user" ? colors.onDark : colors.ink, border: m.role === "user" ? "none" : `1.4px solid ${colors.line}` }}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "12px 0 10px" }}>
        {quick.map(q => <Tag key={q} onClick={() => send(q)}>{q}</Tag>)}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: colors.surface, border: `1.4px solid ${colors.line}`, borderRadius: 14, padding: "8px 8px 8px 14px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send() }}
          placeholder="Ask about sessions, people, or your day"
          style={{ border: "none", outline: "none", flex: 1, fontSize: fontSize.body, background: "transparent", color: colors.ink }} />
        <button onClick={() => send()} disabled={!input.trim()}
          style={{ width: 38, height: 38, borderRadius: radii.md, border: "none", cursor: input.trim() ? "pointer" : "not-allowed", background: input.trim() ? colors.violet : colors.line, color: colors.onDark, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Send size={17} />
        </button>
      </div>
    </div>
  )
}

export default ClawbieChat
