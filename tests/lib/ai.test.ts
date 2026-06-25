import { describe, it, expect } from 'vitest'
import { localReadinessReview, localAnswer, localPitchFeedback, localReason } from '@/lib/ai/local-fallbacks'

describe('localReadinessReview', () => {
  it('flags missing demo link when absent', () => {
    const result = localReadinessReview('We built a great AI product with agents.')
    expect(result).toContain('demo')
  })

  it('flags thin write-up when under 40 words', () => {
    const result = localReadinessReview('Short text.')
    expect(result.toLowerCase()).toMatch(/thin|spell out|judges skim/)
  })

  it('positive when demo link and enough detail — gaps section reads "None obvious"', () => {
    const text = 'We built an AI agent that helps users find jobs. Demo at https://demo.example.com. ' +
      'It uses Claude LLM to parse resumes and match candidates. The agent loops through job boards and returns ranked results. ' +
      'Judges can interact with the live demo link above to see it working in real time.'
    const result = localReadinessReview(text)
    expect(result).toContain('Strengths')
    expect(result).toContain('Gaps')
    // All three signals are present (demo link, AI, >40 words) so gaps should be empty
    expect(result).toContain('None obvious')
  })
})

describe('localAnswer', () => {
  const me = {
    tags: ['Agents', 'Backend'],
    industries: ['Fintech'],
    looking: ['Teammate'],
  }

  const attendees = [
    { id: 'a1', name: 'Alice', tags: ['Agents', 'Frontend'], industries: ['Fintech'], looking: ['Teammate'], occupation: 'Engineer', bio: '' },
    { id: 'a2', name: 'Bob', tags: ['ML', 'Data'], industries: ['Healthcare'], looking: ['Mentor'], occupation: 'Researcher', bio: '' },
    { id: 'a3', name: 'Carol', tags: ['Agents', 'Backend'], industries: ['Fintech'], looking: ['Teammate'], occupation: 'Dev', bio: '' },
  ]

  const venues = {
    gem: { name: 'GEM Center', area: 'District 1' },
    dream: { name: 'Dreamplex', area: 'District 1' },
  }

  const ctx = {
    attendees,
    sessions: [],
    days: [],
    venues,
    schedule: new Set<string>(),
    catchups: [],
    currentDay: 0,
    currentMins: 540,
  }

  it('who should I meet returns top tag-overlap names', () => {
    const result = localAnswer(me, ctx, 'who should I meet')
    // Carol and Alice both share Agents; Carol also shares Backend + Fintech
    expect(result).toContain('Carol')
    expect(result).toContain('Alice')
  })

  it('query about who returns names', () => {
    const result = localAnswer(me, ctx, 'who is here')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('now branch uses human-readable venue name (not raw key)', () => {
    const ctxWithSession = {
      ...ctx,
      days: [{ idx: 0, label: 'Day 1', date: '2025-11-01' }],
      sessions: [{ id: 's1', day: 0, start: 500, end: 600, title: 'Opening Keynote', venue: 'gem', tags: [] }],
      currentMins: 540,
    }
    const result = localAnswer(me, ctxWithSession, 'what is happening now')
    expect(result).toContain('GEM Center')
    expect(result).not.toContain(' at gem')
  })
})

describe('localPitchFeedback', () => {
  it('reports an approximate spoken duration from word count', () => {
    const text = Array.from({ length: 130 }, () => 'word').join(' ')
    const out = localPitchFeedback(text)
    expect(out).toContain('130 words')
    expect(out).toContain('1.0 minutes')
  })
  it('always includes the structure reminder and judge questions', () => {
    const out = localPitchFeedback('short pitch')
    expect(out).toContain('the problem in one sentence')
    expect(out).toContain('Likely judge questions')
  })
})

describe('localReason', () => {
  it('names a shared tag when interests overlap', () => {
    const me = { tags: ['Agents', 'RAG'], industries: [], looking: ['Teammate'] }
    const p = { tags: ['Agents'], industries: [], looking: ['Teammate'] }
    expect(localReason(me, p)).toContain('Agents')
  })
  it('falls back to a generic line when there is no overlap', () => {
    const me = { tags: ['Mobile'], industries: [], looking: [] }
    const p = { tags: ['Backend'], industries: [], looking: [] }
    expect(localReason(me, p).length).toBeGreaterThan(0)
  })
})

