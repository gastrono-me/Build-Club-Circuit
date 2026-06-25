import { describe, it, expect } from 'vitest'
import { normalizeSocialLink } from '@/lib/social'

describe('normalizeSocialLink', () => {
  it('expands a bare handle', () => { expect(normalizeSocialLink('github', 'jdoe')).toBe('https://github.com/jdoe') })
  it('strips a leading @', () => { expect(normalizeSocialLink('x', '@jdoe')).toBe('https://x.com/jdoe') })
  it('passes a full url through unchanged', () => { expect(normalizeSocialLink('linkedin', 'https://linkedin.com/in/jdoe')).toBe('https://linkedin.com/in/jdoe') })
  it('trims whitespace', () => { expect(normalizeSocialLink('instagram', '  jdoe  ')).toBe('https://instagram.com/jdoe') })
  it('returns empty string for empty input', () => { expect(normalizeSocialLink('github', '')).toBe('') })
})
