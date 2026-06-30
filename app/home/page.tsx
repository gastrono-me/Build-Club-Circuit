"use client"

import { TodayView } from "@/components/today/TodayView"

// The app home: the daily ship ritual. Behind the auth gate (see middleware).
export default function Home() {
  return <TodayView />
}
