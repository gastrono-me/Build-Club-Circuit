import { Calendar } from "@/components/discover/Calendar"
import { colors, spacing } from "@/lib/design/tokens"

export default function DiscoverPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.surface,
        padding: spacing[4],
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Calendar />
      </div>
    </div>
  )
}
