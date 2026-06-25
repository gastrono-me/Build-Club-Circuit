import { describe, it, expect } from 'vitest'
import { hm, fmt, toAbsoluteMinutes } from '@/lib/time'
describe('time', () => {
  it('hm converts to minutes-since-midnight', () => { expect(hm(10,15)).toBe(615) })
  it('fmt renders 12-hour', () => { expect(fmt(615)).toBe('10:15 AM'); expect(fmt(0)).toBe('12:00 AM'); expect(fmt(13*60)).toBe('1:00 PM') })
  it('toAbsoluteMinutes spans days', () => { expect(toAbsoluteMinutes({day:1,mins:hm(10,15)})).toBe(24*60+615) })
})
