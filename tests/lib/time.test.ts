import { describe, it, expect } from 'vitest'
import { hm, fmt, toAbsoluteMinutes, shipTime, shipDate, shipDayHeading, shipClock, localDayKey } from '@/lib/time'
describe('time', () => {
  it('hm converts to minutes-since-midnight', () => { expect(hm(10,15)).toBe(615) })
  it('fmt renders 12-hour', () => { expect(fmt(615)).toBe('10:15 AM'); expect(fmt(0)).toBe('12:00 AM'); expect(fmt(13*60)).toBe('1:00 PM') })
  it('toAbsoluteMinutes spans days', () => { expect(toAbsoluteMinutes({day:1,mins:hm(10,15)})).toBe(24*60+615) })
})

describe('shipTime', () => {
  const now = new Date('2026-07-04T12:00:00')
  it('is relative while fresh', () => {
    expect(shipTime(new Date('2026-07-04T11:59:40').toISOString(), now)).toBe('just now')
    expect(shipTime(new Date('2026-07-04T11:48:00').toISOString(), now)).toBe('12m ago')
    expect(shipTime(new Date('2026-07-04T07:00:00').toISOString(), now)).toBe('5h ago')
  })
  it('becomes a date after a day', () => {
    expect(shipTime(new Date('2026-07-02T09:00:00').toISOString(), now)).toBe('Jul 2')
  })
  it('adds the year when it is not this year', () => {
    expect(shipTime(new Date('2025-12-12T09:00:00').toISOString(), now)).toBe('Dec 12, 2025')
    expect(shipDate(new Date('2025-12-12T09:00:00').toISOString(), now)).toBe('Dec 12, 2025')
  })
  it('renders day headings and clock times for the timeline', () => {
    const iso = new Date('2026-07-01T14:05:00').toISOString()
    expect(shipDayHeading(iso, now)).toBe('Wednesday, Jul 1')
    expect(shipClock(iso)).toBe('2:05 PM')
  })
  it('groups by local day key', () => {
    expect(localDayKey(new Date('2026-07-01T23:30:00').toISOString())).toBe('2026-07-01')
  })
})
