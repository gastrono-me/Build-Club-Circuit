"use client"

import React, { useEffect, useState } from "react"
import { Search, Sparkles, ArrowRight, SlidersHorizontal, ChevronDown, ChevronUp, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/lib/hooks/useProfile"
import { useSocial } from "@/components/shell/SocialProvider"
import { keywordSearch } from "@/lib/search"
import { localReason } from "@/lib/ai/local-fallbacks"
import { matchScore } from "@/lib/match"
import { Input } from "@/components/ui/Input"
import { Tag } from "@/components/ui/Tag"
import { Button } from "@/components/ui/Button"
import { SectionTitle } from "@/components/ui/SectionTitle"
import { PersonCard, type NormalizedPerson } from "@/components/people/PersonCard"
import { PeopleField } from "@/components/people/PeopleField"
import type { Profile } from "@/types/index"
import { ALL_TAGS, INDUSTRIES, LOOKING } from "@/types/index"
import { colors, fonts, fontSize, fontWeight, radii, spacing } from "@/lib/design/tokens"

type View = "all" | "connected"

export function PeopleDirectory() {
  const { profile } = useProfile()
  const { catchups } = useSocial()
  const connectedIds = new Set(catchups.map(c => c.otherId))

  const [realProfiles, setRealProfiles] = useState<NormalizedPerson[]>([])
  const [signedInId, setSignedInId] = useState<string | null>(null)
  const [loadingProfiles, setLoadingProfiles] = useState(true)

  const [query, setQuery] = useState("")
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
  const [selectedLooking, setSelectedLooking] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<View>("all")
  const [reasons, setReasons] = useState<Record<string, string> | null>(null)
  const [matchedIds, setMatchedIds] = useState<string[]>([])

  useEffect(() => {
    async function fetchProfiles() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setSignedInId(user?.id ?? null)

      const { data } = await supabase.from("profiles").select("*")
      if (data) {
        const normalized: NormalizedPerson[] = (data as (Profile & { id: string })[])
          .map(row => ({
            id: row.id,
            name: row.name ?? "",
            occupation: row.org
              ? `${row.occupation ?? ""}${row.occupation && row.org ? " · " : ""}${row.org}`
              : (row.occupation ?? ""),
            tags: row.skills ?? [],
            industries: row.industries ?? [],
            looking: row.looking ?? [],
            bio: row.bio ?? "",
            tagline: row.tagline,
            links: row.links,
            avatar: row.avatar_url ?? null,
            isReal: true,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setRealProfiles(normalized)
      }
      setLoadingProfiles(false)
    }

    fetchProfiles()
  }, [])

  // Real users only; the signed-in user's own profile is shown separately, pinned above the directory
  const allPeople: NormalizedPerson[] = realProfiles.filter(p => p.id !== signedInId)
  const selfPerson = realProfiles.find(p => p.id === signedInId) ?? null

  // Apply keyword search (NormalizedPerson lacks an index signature required by SearchablePerson,
  // so we cast through unknown on the input and output)
  const afterKeyword = keywordSearch(
    allPeople as unknown as Parameters<typeof keywordSearch>[0],
    query,
  ) as unknown as NormalizedPerson[]

  // Apply chip filters
  const afterChips = afterKeyword.filter(person => {
    const skillsOk =
      selectedSkills.length === 0 ||
      selectedSkills.some(s => person.tags.includes(s))
    const industriesOk =
      selectedIndustries.length === 0 ||
      selectedIndustries.some(i => person.industries.includes(i))
    const lookingOk =
      selectedLooking.length === 0 ||
      selectedLooking.some(l => person.looking.includes(l))
    return skillsOk && industriesOk && lookingOk
  })

  // Apply All / Connected view
  const filtered = view === "connected"
    ? afterChips.filter(p => connectedIds.has(p.id))
    : afterChips

  const activeFilterCount = selectedSkills.length + selectedIndustries.length + selectedLooking.length

  function toggleSkill(tag: string) {
    setSelectedSkills(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }
  function toggleIndustry(ind: string) {
    setSelectedIndustries(prev =>
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
    )
  }
  function toggleLooking(l: string) {
    setSelectedLooking(prev =>
      prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]
    )
  }
  function clearChipFilters() {
    setSelectedSkills([])
    setSelectedIndustries([])
    setSelectedLooking([])
  }

  function findMatches() {
    const meForMatch = profile
      ? { tags: profile.skills, industries: profile.industries, looking: profile.looking }
      : { tags: [], industries: [], looking: [] }
    const ranked = [...filtered]
      .sort((a, b) => matchScore(meForMatch, b).score - matchScore(meForMatch, a).score)
      .slice(0, 6)
    const map: Record<string, string> = {}
    ranked.forEach(p => { map[p.id] = localReason(meForMatch, { tags: p.tags, industries: p.industries, looking: p.looking }) })
    setReasons(map)
    setMatchedIds(ranked.map(p => p.id))
  }

  function clearSuggestions() {
    setReasons(null)
    setMatchedIds([])
  }

  // Suggested-for-you picks stay pinned above the rest of the grid, in ranked order.
  const suggested = matchedIds
    .map(id => filtered.find(p => p.id === id))
    .filter((p): p is NormalizedPerson => Boolean(p))
  const suggestedIds = new Set(suggested.map(p => p.id))
  const rest = filtered.filter(p => !suggestedIds.has(p.id))

  return (
    <div>
      <SectionTitle
        kicker={`${filtered.length} ${filtered.length === 1 ? "person" : "people"}`}
        title="Find your people"
        note="Browse and filter by skills, industries, and what people are looking for."
      />

      {/* Keyword search */}
      <div style={{ marginBottom: spacing[4] }}>
        <Input
          placeholder="Search by name, role, org, or bio…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          icon={<Search size={15} />}
        />
      </div>

      {/* All / Connected view toggle */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          background: colors.line,
          borderRadius: radii.pill,
          padding: 2,
          marginBottom: spacing[5],
        }}
      >
        {(["all", "connected"] as View[]).map(v => {
          const active = view === v
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontFamily: fonts.mono,
                fontSize: fontSize.label,
                fontWeight: fontWeight.semibold,
                padding: `${spacing[1]}px ${spacing[3]}px`,
                borderRadius: radii.pill,
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.05em",
                lineHeight: 1.4,
                background: active ? colors.violet : "transparent",
                color: active ? colors.onDark : colors.mutedSoft,
                textTransform: "uppercase",
              }}
            >
              {v === "all" ? "All" : `Connected (${connectedIds.size})`}
            </button>
          )
        })}
      </div>

      {/* People field — the room as an embedding field, vectors to your complements */}
      <PeopleField people={allPeople} me={profile} meId={signedInId} />

      {/* Who should I meet CTA */}
      <div style={{ background: colors.ink, borderRadius: radii["2xl"], padding: 16, marginBottom: spacing[5], display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, color: colors.onDark }}>
          <div style={{ fontFamily: fonts.display, fontWeight: fontWeight.semibold, fontSize: fontSize.heading, display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={17} /> Who should I meet?</div>
          <div style={{ fontSize: fontSize.meta, opacity: 0.8, marginTop: 3 }}>Match-picked intros based on your skills and what you are looking for.</div>
        </div>
        <Button variant="accent" icon={<ArrowRight size={15} />} onClick={findMatches}>Find my matches</Button>
      </div>

      {/* Filters — collapsed by default; chip rows take a lot of vertical space, especially on mobile */}
      <div style={{ marginBottom: spacing[6] }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
          <button
            type="button"
            onClick={() => setFiltersOpen(prev => !prev)}
            aria-expanded={filtersOpen}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: spacing[2],
              background: "transparent",
              border: `1.5px solid ${colors.ink}`,
              borderRadius: radii.md,
              padding: `${spacing[2]}px ${spacing[3]}px`,
              cursor: "pointer",
              fontFamily: fonts.mono,
              fontSize: fontSize.label,
              fontWeight: fontWeight.semibold,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: colors.ink,
            }}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: colors.violet,
                  color: colors.onDark,
                  borderRadius: radii.pill,
                  minWidth: 16,
                  height: 16,
                  fontSize: fontSize.micro,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                }}
              >
                {activeFilterCount}
              </span>
            )}
            {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearChipFilters}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: fonts.mono,
                fontSize: fontSize.label,
                color: colors.muted,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {filtersOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[4], marginTop: spacing[4] }}>
            {/* Skills */}
            <div>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  color: colors.muted,
                  marginBottom: spacing[2],
                }}
              >
                Skills
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: spacing[2] }}>
                {ALL_TAGS.map(tag => (
                  <Tag
                    key={tag}
                    active={selectedSkills.includes(tag)}
                    onClick={() => toggleSkill(tag)}
                  >
                    {tag}
                  </Tag>
                ))}
              </div>
            </div>

            {/* Industries */}
            <div>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  color: colors.muted,
                  marginBottom: spacing[2],
                }}
              >
                Industries
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: spacing[2] }}>
                {INDUSTRIES.map(ind => (
                  <Tag
                    key={ind}
                    active={selectedIndustries.includes(ind)}
                    onClick={() => toggleIndustry(ind)}
                  >
                    {ind}
                  </Tag>
                ))}
              </div>
            </div>

            {/* Looking for */}
            <div>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: fontSize.label,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  color: colors.muted,
                  marginBottom: spacing[2],
                }}
              >
                Looking for
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: spacing[2] }}>
                {LOOKING.map(l => (
                  <Tag
                    key={l}
                    active={selectedLooking.includes(l)}
                    onClick={() => toggleLooking(l)}
                  >
                    {l}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loadingProfiles && (
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: fontSize.meta,
            color: colors.mutedSoft,
            marginBottom: spacing[4],
          }}
        >
          Loading profiles…
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && !loadingProfiles && (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.muted,
            padding: `${spacing[8]}px 0`,
            textAlign: "center" as const,
          }}
        >
          {view === "connected" ? "No connections match your filters yet." : "No people match your filters."}
        </div>
      )}

      {/* Your own profile — pinned above the directory, not part of search/filter/match results */}
      {selfPerson && (
        <div style={{ marginBottom: spacing[6] }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: colors.muted, marginBottom: spacing[3] }}>
            Your profile
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: spacing[4] }}>
            <PersonCard person={selfPerson} me={profile} isSelf />
          </div>
        </div>
      )}

      {/* Suggested for you — ranked match picks, pinned above the rest of the grid */}
      {suggested.length > 0 && (
        <div style={{ marginBottom: spacing[6] }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[3] }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: colors.violet }}>
              <Sparkles size={14} /> Suggested for you
            </div>
            <button
              type="button"
              onClick={clearSuggestions}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.muted, fontFamily: fonts.mono, fontSize: fontSize.label, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Clear
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: spacing[4],
            }}
          >
            {suggested.map(person => (
              <PersonCard key={person.id} person={person} me={profile} reason={reasons?.[person.id]} />
            ))}
          </div>
        </div>
      )}

      {/* Main people grid */}
      {rest.length > 0 && (
        <div>
          {suggested.length > 0 && (
            <div style={{ fontFamily: fonts.mono, fontSize: fontSize.label, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: colors.muted, marginBottom: spacing[3] }}>
              All people
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: spacing[4],
            }}
          >
            {rest.map(person => (
              <PersonCard key={person.id} person={person} me={profile} reason={reasons?.[person.id]} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PeopleDirectory
