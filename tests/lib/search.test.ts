import { describe, it, expect } from 'vitest'
import { keywordSearch } from '@/lib/search'

const people = [
  { id: 'p1', name: 'Marco Rossi', occupation: 'Engineer', tagline: 'Building fast', bio: 'Founder from Italy who loves pasta.', skills: [], industries: ['Fintech'], looking: [] },
  { id: 'p2', name: 'Jane Smith', occupation: 'Designer', tagline: 'Product craft', bio: 'UX designer based in Berlin.', skills: [], industries: ['Design'], looking: [] },
  { id: 'p3', name: 'Ali Hassan', occupation: 'ML Engineer', tagline: 'AI systems', bio: 'Deep learning researcher.', skills: ['ML'], industries: [], looking: [] },
]

// Real Attendee-shaped objects: have role/org/bio but NO occupation/tagline
const attendees = [
  { id: 'a1', name: 'Nguyen Van A', role: 'Product Manager', org: 'Techvify', tags: [], industries: [], looking: [], bio: 'Building at the intersection of AI and healthcare.' },
  { id: 'a2', name: 'Tran Thi B',  role: 'Developer',        org: 'VNG Corp',  tags: [], industries: [], looking: [], bio: 'Interested in distributed systems.' },
]

describe('keywordSearch', () => {
  it('empty query returns all people', () => {
    expect(keywordSearch(people, '')).toHaveLength(3)
  })

  it('matches on bio text (case-insensitive substring)', () => {
    const results = keywordSearch(people, 'italy')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Marco Rossi')
  })

  it('matches on name', () => {
    const results = keywordSearch(people, 'jane')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Jane Smith')
  })

  it('matches on occupation', () => {
    const results = keywordSearch(people, 'ML Engineer')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Ali Hassan')
  })

  it('matches on tagline', () => {
    const results = keywordSearch(people, 'product craft')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Jane Smith')
  })

  it('tag values in industries do NOT match (not in text fields)', () => {
    // 'Fintech' is only in industries[], not in name/occupation/tagline/bio
    const results = keywordSearch(people, 'Fintech')
    expect(results).toHaveLength(0)
  })

  it('returns empty array for no match', () => {
    expect(keywordSearch(people, 'xyznotfound')).toHaveLength(0)
  })

  describe('Attendee-shaped objects (role/org/bio, no occupation/tagline)', () => {
    it('matches keyword in role field', () => {
      const results = keywordSearch(attendees, 'Product Manager')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Nguyen Van A')
    })

    it('matches keyword in org field', () => {
      const results = keywordSearch(attendees, 'VNG Corp')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Tran Thi B')
    })

    it('matches keyword in bio field (Attendee shape)', () => {
      const results = keywordSearch(attendees, 'healthcare')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Nguyen Van A')
    })
  })
})
