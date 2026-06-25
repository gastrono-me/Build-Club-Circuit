"use client"

import React, { createContext, useContext, useState } from "react"
import { hm } from "@/lib/time"

interface SimClockState {
  day: number
  mins: number
  setDay: (d: number) => void
  setMins: (m: number) => void
}

const SimClockContext = createContext<SimClockState | null>(null)

export function SimClockProvider({ children }: { children: React.ReactNode }) {
  const [day, setDay] = useState(1)
  const [mins, setMins] = useState(hm(10, 15))

  return (
    <SimClockContext.Provider value={{ day, mins, setDay, setMins }}>
      {children}
    </SimClockContext.Provider>
  )
}

export function useSimClock(): SimClockState {
  const ctx = useContext(SimClockContext)
  if (!ctx) throw new Error("useSimClock must be used within a SimClockProvider")
  return ctx
}
