"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Loader2 } from "lucide-react"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { Button } from "@/components/ui/Button"
import { localPitchFeedback } from "@/lib/ai/local-fallbacks"
import { colors, radii, fonts, fontSize, fontWeight, spacing } from "@/lib/design/tokens"

export function PitchCoach() {
  const [pitch, setPitch] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(180)
  const [running, setRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => { if (t <= 1) { setRunning(false); return 0 } return t - 1 })
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running])

  function reset() { setRunning(false); setTimeLeft(180) }

  function getFeedback() {
    if (!pitch.trim()) return
    setLoading(true)
    setFeedback(null)
    // Local fallback only (no token spend, by design).
    setFeedback(localPitchFeedback(pitch))
    setLoading(false)
  }

  const mm = Math.floor(timeLeft / 60)
  const ss = String(timeLeft % 60).padStart(2, "0")

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: spacing[4] }}>
      <SectionTitle kicker="Your build" title="Pitch Coach"
        note="Three minutes on the clock. Practice your pitch and get blunt feedback before an investor, customer, or demo audience hears it." />

      <div style={{ background: colors.ink, color: colors.onDark, borderRadius: radii["2xl"], padding: 20, marginBottom: spacing[5], display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.06em", opacity: 0.8 }}>PRACTICE TIMER</div>
          <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.bold, fontSize: 34, marginTop: 4 }}>{mm}:{ss}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="accent" onClick={() => setRunning(r => !r)}>{running ? "Pause" : "Start"}</Button>
          <Button variant="secondary" onClick={reset} style={{ color: colors.onDark, borderColor: colors.onDark }}>Reset</Button>
        </div>
      </div>

      <div style={{ background: colors.surface, border: `1.5px solid ${colors.line}`, borderRadius: radii["2xl"], padding: 18 }}>
        <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, marginBottom: 6, display: "flex", alignItems: "center", gap: 7, color: colors.ink }}>
          <Mic size={16} /> Your pitch
        </div>
        <textarea value={pitch} onChange={e => setPitch(e.target.value)} rows={7}
          placeholder="Paste your pitch script or talking points"
          style={{ width: "100%", border: `1.4px solid ${colors.line}`, borderRadius: radii.md, padding: "10px 12px", fontSize: fontSize.body, outline: "none", resize: "vertical", fontFamily: fonts.body, color: colors.ink, background: colors.paper2 }} />
        <div style={{ marginTop: 10 }}>
          <Button variant="primary" onClick={getFeedback} disabled={loading || !pitch.trim()}
            icon={loading ? <Loader2 size={15} className="vec-spin" /> : undefined}>
            {loading ? "Reviewing" : "Get feedback"}
          </Button>
        </div>
        {feedback && (
          <div style={{ marginTop: 14, background: colors.panel, borderRadius: radii.lg, padding: 14, fontSize: fontSize.body, lineHeight: 1.6, whiteSpace: "pre-wrap", color: colors.ink }}>
            {feedback}
          </div>
        )}
      </div>
    </div>
  )
}

export default PitchCoach
