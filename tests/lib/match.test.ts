import { describe, it, expect } from 'vitest'
import { matchScore } from '@/lib/match'

describe('matchScore', () => {
  const me = {
    tags: ['Agents', 'Backend'],
    industries: ['Fintech', 'DevTools'],
    looking: ['Teammate'],
  }

  it('returns zero score for null me', () => {
    const result = matchScore(null, { tags: ['Agents'], industries: [], looking: [] })
    expect(result).toEqual({ score: 0, shared: [], sharedIndustries: [] })
  })

  it('computes shared tags correctly', () => {
    const person = { tags: ['Agents', 'Frontend'], industries: [], looking: [] }
    const { shared } = matchScore(me, person)
    expect(shared).toEqual(['Agents'])
  })

  it('computes sharedIndustries correctly', () => {
    const person = { tags: [], industries: ['Fintech', 'Healthcare'], looking: [] }
    const { sharedIndustries } = matchScore(me, person)
    expect(sharedIndustries).toEqual(['Fintech'])
  })

  it('score = shared*10 + sharedIndustries*4 + looking bonus', () => {
    const person = { tags: ['Agents', 'Backend'], industries: ['Fintech'], looking: ['Teammate'] }
    const { score, shared, sharedIndustries } = matchScore(me, person)
    expect(shared).toEqual(['Agents', 'Backend'])
    expect(sharedIndustries).toEqual(['Fintech'])
    // 2*10 + 1*4 + 8 (looking match) = 32
    expect(score).toBe(32)
  })

  it('no looking bonus when looking does not complement', () => {
    const person = { tags: ['Agents'], industries: [], looking: ['Just networking'] }
    // Teammate does not match Just networking via LOOKING_PAIRS
    const { score } = matchScore(me, person)
    expect(score).toBe(10) // 1 shared tag * 10, no industries, no looking bonus
  })
})
