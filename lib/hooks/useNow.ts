"use client"

import { useEffect, useState } from "react"

/**
 * A Date that ticks, so relative timestamps ("2m ago") don't freeze at their
 * first render. Starts null (matching the server render, so hydration never
 * mismatches), resolves on mount, then updates every `intervalMs`.
 */
export function useNow(intervalMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
