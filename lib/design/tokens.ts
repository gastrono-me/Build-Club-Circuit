/**
 * Circuit design tokens — the single source of truth for the look.
 *
 * Direction: "embedding field / architect plotter on technical paper".
 * The screen reads like a plotter instrument on drafting paper — ink borders,
 * hard offset shadows, mono uppercase labels, Fraunces display type.
 *
 * Tune the whole product from here. `app/globals.css` mirrors these values as
 * CSS custom properties; the primitives consume the variables. Keep both in
 * sync (values here are the canonical source).
 */

/* ------------------------------------------------------------------ */
/*  Colors                                                             */
/* ------------------------------------------------------------------ */
export const colors = {
  /** Technical paper. The working surface everything sits on. */
  ink: '#14143C',
  /** Near-white paper background. */
  surface: '#EEF1F4',
  /** Raised panel / card surface above the paper. */
  panel: '#EEF1F4',
  /** Hairline borders, dividers. */
  line: '#cfd6df',

  /** Primary accent — vector blue. Used with restraint. */
  violet: '#2B2BF5',
  violetSoft: '#E8E8FE',

  /** Oxblood — infra / danger accent. */
  live: '#8A2233',
  liveSoft: '#F5E0E3',

  /** Confirmed / go. Kept from original system. */
  go: '#0E9F6E',
  goSoft: '#DEF5EC',

  /** Graphite — secondary text. */
  muted: '#5A5F6B',
  /** Tertiary — very quiet. */
  mutedSoft: '#9aa2af',

  /** Always-on-dark text (on ink, vector fills). */
  onDark: '#EEF1F4',

  /* -- Extra palette members exposed for use in primitives -- */
  /** Raised surface, slightly darker than paper. */
  paper2: '#E3E8EE',
  /** Soft line for backgrounds, not borders. */
  lineSoft: '#dbe1e9',
  /** Oxblood (alias for live, for semantic clarity). */
  oxblood: '#8A2233',
} as const;

/** Avatar fill rotation — deterministic per name, within new palette. */
export const avatarPalette = [
  colors.violet,      // vector blue
  colors.ink,         // ink
  colors.oxblood,     // oxblood
  '#0072B5',          // steel blue
  '#B26B00',          // amber
] as const;

/* ------------------------------------------------------------------ */
/*  Typography                                                         */
/* ------------------------------------------------------------------ */
/**
 * Three roles, used with intent:
 *  - display: Fraunces. Optical-size serif. Titles only.
 *  - body:    IBM Plex Sans. Quiet, legible. Prose and labels.
 *  - mono:    IBM Plex Mono. Data, times, kickers, tags — uppercase tracked.
 *
 * Values reference the CSS variables wired by next/font in app/layout.tsx.
 */
export const fonts = {
  display: "var(--font-display), 'Fraunces', serif",
  body: "var(--font-body), 'IBM Plex Sans', system-ui, sans-serif",
  mono: "var(--font-mono), 'IBM Plex Mono', ui-monospace, monospace",
} as const;

/** Mobile-first type scale (px). Tight at the top, calm in the body. */
export const fontSize = {
  display: 30,  // page heroes
  title: 24,    // SectionTitle h2
  heading: 16,  // card titles
  body: 15,     // prose
  meta: 13,     // secondary meta
  label: 11,    // mono kickers / tags / data labels
  micro: 10,    // timestamps, fine print
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  tight: 1.05, // display
  snug: 1.25,  // titles / card headings
  normal: 1.5, // body prose
} as const;

export const letterSpacing = {
  display: '-0.03em', // big type pulls together
  label: '0.08em',    // mono kickers spread out
  tag: '0.04em',      // tag pills, tracked
} as const;

/* ------------------------------------------------------------------ */
/*  Radii — consistent, never mixed at random                         */
/* ------------------------------------------------------------------ */
export const radii = {
  sm: 8,    // small chips, inner controls
  md: 10,   // buttons, icon buttons, inputs
  lg: 10,   // avatars, secondary panels
  xl: 10,   // cards (matches --r in mockup)
  '2xl': 10, // modals
  pill: 999, // tags, toggles
} as const;

/* ------------------------------------------------------------------ */
/*  Spacing — 4px rhythm                                               */
/* ------------------------------------------------------------------ */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/* ------------------------------------------------------------------ */
/*  Shadows — hard offset, plotter instrument style                    */
/* ------------------------------------------------------------------ */
export const shadows = {
  /** Hard offset shadow on cards — the plotter instrument signature. */
  card: '6px 6px 0 rgba(20,20,60,0.08)',
  /** Pressed/active state — reduced offset. */
  inset: '0 1px 2px rgba(0, 0, 0, 0.08)',
  /** Modal — same hard offset, larger. */
  modal: '8px 8px 0 rgba(20,20,60,0.12)',
  /** Focus ring — vector blue. Applied via outline elsewhere. */
  focus: '0 0 0 3px rgba(43,43,245,0.28)',
} as const;

/* ------------------------------------------------------------------ */
/*  Motion                                                             */
/* ------------------------------------------------------------------ */
export const motion = {
  fast: '120ms',
  base: '180ms',
  ease: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

/** The whole token bag, for ergonomic single-import consumption. */
export const tokens = {
  colors,
  avatarPalette,
  fonts,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  radii,
  spacing,
  shadows,
  motion,
} as const;

export type Tokens = typeof tokens;
export type ColorToken = keyof typeof colors;

export default tokens;
