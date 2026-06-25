import { describe, it, expect } from 'vitest'
import { useEventData } from '@/lib/data/useEventData'
import { BLOCKER_TAGS } from '@/types/index'

describe('useEventData', () => {
  it('returns sessions, days, venues synchronously', () => {
    const data = useEventData()
    expect(data).toHaveProperty('sessions')
    expect(data).toHaveProperty('days')
    expect(data).toHaveProperty('venues')
  })

  it('sessions array is non-empty and each session has required fields', () => {
    const { sessions } = useEventData()
    expect(sessions.length).toBeGreaterThan(0)
    for (const s of sessions) {
      expect(s).toHaveProperty('id')
      expect(s).toHaveProperty('day')
      expect(s).toHaveProperty('start')
      expect(s).toHaveProperty('end')
      expect(s).toHaveProperty('title')
      expect(s).toHaveProperty('venue')
      expect(s).toHaveProperty('type')
      expect(s).toHaveProperty('tags')
    }
  })

  it('days array has 5 entries matching AABW schedule', () => {
    const { days } = useEventData()
    expect(days).toHaveLength(5)
  })

  it('venues object has expected venues', () => {
    const { venues } = useEventData()
    expect(venues).toHaveProperty('gem')
    expect(venues).toHaveProperty('dream')
    expect(venues).toHaveProperty('sihub')
  })
})

describe('BLOCKER_TAGS', () => {
  it('includes "hackathon help"', () => {
    expect(BLOCKER_TAGS).toContain('hackathon help')
  })

  it('includes "Other"', () => {
    expect(BLOCKER_TAGS).toContain('Other')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(BLOCKER_TAGS)).toBe(true)
    expect(BLOCKER_TAGS.length).toBeGreaterThan(0)
  })
})
