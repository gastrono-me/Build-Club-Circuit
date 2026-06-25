import { ScheduleView } from "@/components/schedule/ScheduleView"
import { colors, spacing } from "@/lib/design/tokens"

export default function SchedulePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.surface,
        padding: spacing[4],
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <ScheduleView />
      </div>
    </div>
  )
}
