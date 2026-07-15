"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useNow } from "@/lib/hooks/useNow"
import type {
  CoworkingGoal,
  EventCheckin,
  EventDemo,
  EventSpace,
  FocusItem,
  Huddle,
  HuddleKind,
} from "@/lib/coworking/types"

export interface DemoShip {
  id: string
  note: string
  kind: string
  project_id: string | null
  project_name: string | null
  created_at: string
}

interface CheckinInput {
  projectId: string | null
  goal: CoworkingGoal
  intention: string
  focusItems: string[]
}

interface SpaceInput {
  name: string
  description?: string
  capacity?: number | null
}

interface HuddleInput {
  spaceId: string | null
  topic: string
  kind: HuddleKind
  welcomeSkills: string[]
  welcomeIndustries: string[]
  startsAt: string
  endsAt: string
}

/**
 * One event's complete live coworking state. All reads remain RLS protected;
 * mutations are intentionally small and map one-to-one to the additive 031
 * tables. Realtime table events refetch this bounded event-sized snapshot.
 */
export function useCoworking(eventId: string | null, startsAt?: string | null, endsAt?: string | null) {
  const [checkins, setCheckins] = useState<EventCheckin[]>([])
  const [spaces, setSpaces] = useState<EventSpace[]>([])
  const [huddles, setHuddles] = useState<Huddle[]>([])
  const [demos, setDemos] = useState<EventDemo[]>([])
  const [myShips, setMyShips] = useState<DemoShip[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const topicRef = useRef(`coworking-${Math.random().toString(36).slice(2)}`)
  const now = useNow(15_000)

  const fetchAll = useCallback(async () => {
    if (!eventId) {
      setCheckins([]); setSpaces([]); setHuddles([]); setDemos([]); setMyShips([]); setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    setUserId(uid)

    const [checkinResult, spaceResult, huddleResult, participantResult, demoResult] = await Promise.all([
      supabase.from("event_checkins").select("*").eq("event_id", eventId).order("checked_in_at"),
      supabase.from("event_spaces").select("*").eq("event_id", eventId).order("name"),
      supabase.from("huddles").select("*").eq("event_id", eventId).order("starts_at"),
      supabase.from("huddle_participants").select("huddle_id,user_id,huddles!inner(event_id)").eq("huddles.event_id", eventId),
      supabase.from("event_demos").select("*").eq("event_id", eventId).order("queued_at"),
    ])

    for (const result of [checkinResult, spaceResult, huddleResult, participantResult, demoResult]) {
      if (result.error) console.error("[coworking] fetch error:", result.error)
    }

    const checkinRows = checkinResult.data ?? []
    const huddleRows = huddleResult.data ?? []
    const demoRows = demoResult.data ?? []
    const profileIds = [...new Set([
      ...checkinRows.map((row: any) => row.user_id),
      ...huddleRows.map((row: any) => row.host_id),
      ...demoRows.map((row: any) => row.user_id),
    ])]
    const projectIds = [...new Set(checkinRows.map((row: any) => row.project_id).filter(Boolean))]
    const checkinIds = checkinRows.map((row: any) => row.id)
    const postIds = demoRows.map((row: any) => row.post_id)

    const [profilesResult, projectsResult, itemsResult, postsResult, ownShipsResult] = await Promise.all([
      profileIds.length
        ? supabase.from("profiles").select("id,name,avatar_url,occupation,skills,industries,looking").in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? supabase.from("projects").select("id,name,stage").in("id", projectIds)
        : Promise.resolve({ data: [], error: null }),
      checkinIds.length
        ? supabase.from("focus_items").select("*").in("checkin_id", checkinIds).order("position").order("created_at")
        : Promise.resolve({ data: [], error: null }),
      postIds.length
        ? supabase.from("build_log").select("id,note,kind,project_id,projects:project_id(name)").in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
      uid
        ? supabase.from("build_log").select("id,note,kind,project_id,created_at").eq("event_id", eventId).eq("author_id", uid).order("created_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null }),
    ])

    const profiles = new Map((profilesResult.data ?? []).map((row: any) => [row.id, row]))
    const projects = new Map((projectsResult.data ?? []).map((row: any) => [row.id, row]))
    const itemsByCheckin = new Map<string, FocusItem[]>()
    for (const item of (itemsResult.data ?? []) as FocusItem[]) {
      const list = itemsByCheckin.get(item.checkin_id) ?? []
      list.push(item)
      itemsByCheckin.set(item.checkin_id, list)
    }

    setCheckins(checkinRows.map((row: any) => {
      const profile: any = profiles.get(row.user_id)
      const project: any = row.project_id ? projects.get(row.project_id) : null
      return {
        ...row,
        profile_name: profile?.name ?? "Builder",
        profile_avatar: profile?.avatar_url ?? null,
        profile_occupation: profile?.occupation ?? null,
        profile_skills: profile?.skills ?? [],
        profile_industries: profile?.industries ?? [],
        profile_looking: profile?.looking ?? [],
        project_name: project?.name ?? null,
        project_stage: project?.stage ?? null,
        focus_items: itemsByCheckin.get(row.id) ?? [],
      } satisfies EventCheckin
    }))

    const spaceMap = new Map((spaceResult.data ?? []).map((row: any) => [row.id, row.name]))
    const participants = new Map<string, string[]>()
    for (const row of participantResult.data ?? []) {
      const list = participants.get(row.huddle_id) ?? []
      list.push(row.user_id)
      participants.set(row.huddle_id, list)
    }
    setSpaces((spaceResult.data ?? []) as EventSpace[])
    setHuddles(huddleRows.map((row: any) => {
      const host: any = profiles.get(row.host_id)
      return {
        ...row,
        host_name: host?.name ?? "Builder",
        host_avatar: host?.avatar_url ?? null,
        space_name: row.space_id ? (spaceMap.get(row.space_id) ?? null) : null,
        participant_ids: participants.get(row.id) ?? [],
      } satisfies Huddle
    }))

    const posts = new Map((postsResult.data ?? []).map((row: any) => [row.id, row]))
    setDemos(demoRows.map((row: any) => {
      const builder: any = profiles.get(row.user_id)
      const post: any = posts.get(row.post_id)
      return {
        ...row,
        builder_name: builder?.name ?? "Builder",
        builder_avatar: builder?.avatar_url ?? null,
        ship_note: post?.note ?? "Ship",
        ship_kind: post?.kind ?? "Update",
        project_name: post?.projects?.name ?? null,
      } satisfies EventDemo
    }))

    const ownProjectIds = [...new Set((ownShipsResult.data ?? []).map((row: any) => row.project_id).filter(Boolean))]
    let ownProjectMap = projects
    const missingOwnProjectIds = ownProjectIds.filter((id) => !ownProjectMap.has(id))
    if (missingOwnProjectIds.length) {
      const { data } = await supabase.from("projects").select("id,name,stage").in("id", missingOwnProjectIds)
      const fetchedProjects = (data ?? []).map((row: any) => [row.id, row] as const)
      ownProjectMap = new Map([...ownProjectMap.entries(), ...fetchedProjects])
    }
    setMyShips((ownShipsResult.data ?? []).map((row: any) => ({
      ...row,
      project_name: row.project_id ? ((ownProjectMap.get(row.project_id) as any)?.name ?? null) : null,
    })))
    setLoading(false)
  }, [eventId])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!eventId) return
    const supabase = createClient()
    const refresh = () => { fetchAll() }
    const channel = supabase
      .channel(topicRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_checkins", filter: `event_id=eq.${eventId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "focus_items" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_spaces", filter: `event_id=eq.${eventId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "huddles", filter: `event_id=eq.${eventId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "huddle_participants" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_demos", filter: `event_id=eq.${eventId}` }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [eventId, fetchAll])

  const eventIsLive = !startsAt || !endsAt || (!!now && now >= new Date(startsAt) && now < new Date(endsAt))
  const activeCheckins = useMemo(
    () => eventIsLive ? checkins.filter((row) => !row.checked_out_at) : [],
    [checkins, eventIsLive],
  )
  const myCheckin = useMemo(
    () => activeCheckins.find((row) => row.user_id === userId) ?? null,
    [activeCheckins, userId],
  )
  const myDemo = useMemo(() => demos.find((row) => row.user_id === userId) ?? null, [demos, userId])

  const checkIn = useCallback(async (input: CheckinInput) => {
    if (!eventId) throw new Error("Event not found")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    // Joining is idempotent and makes event membership follow physical presence.
    const { error: memberError } = await supabase.from("event_members").upsert(
      { event_id: eventId, user_id: user.id },
      { onConflict: "event_id,user_id", ignoreDuplicates: true },
    )
    if (memberError) throw memberError

    const { data: checkin, error } = await supabase.from("event_checkins").upsert({
      event_id: eventId,
      user_id: user.id,
      project_id: input.projectId,
      goal: input.goal,
      intention: input.intention.trim(),
      checked_in_at: new Date().toISOString(),
      checked_out_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id,user_id" }).select("id").single()
    if (error) throw error

    await supabase.from("focus_items").delete().eq("checkin_id", checkin.id).eq("owner_id", user.id)
    const items = input.focusItems.map((title, position) => ({
      checkin_id: checkin.id,
      owner_id: user.id,
      title: title.trim(),
      position,
    })).filter((item) => item.title)
    if (items.length) {
      const { error: itemError } = await supabase.from("focus_items").insert(items)
      if (itemError) throw itemError
    }
    await fetchAll()
  }, [eventId, fetchAll])

  const checkOut = useCallback(async () => {
    if (!myCheckin) return
    const { error } = await createClient().from("event_checkins")
      .update({ checked_out_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", myCheckin.id)
    if (error) throw error
    await fetchAll()
  }, [myCheckin, fetchAll])

  const addFocusItem = useCallback(async (title: string) => {
    if (!myCheckin || !userId) throw new Error("Check in first")
    const { error } = await createClient().from("focus_items").insert({
      checkin_id: myCheckin.id,
      owner_id: userId,
      title: title.trim(),
      position: myCheckin.focus_items.length,
    })
    if (error) throw error
    await fetchAll()
  }, [myCheckin, userId, fetchAll])

  const toggleFocusItem = useCallback(async (item: FocusItem) => {
    const { error } = await createClient().from("focus_items")
      .update({ completed_at: item.completed_at ? null : new Date().toISOString() })
      .eq("id", item.id)
    if (error) throw error
    await fetchAll()
  }, [fetchAll])

  const removeFocusItem = useCallback(async (itemId: string) => {
    const { error } = await createClient().from("focus_items").delete().eq("id", itemId)
    if (error) throw error
    await fetchAll()
  }, [fetchAll])

  const createSpace = useCallback(async (input: SpaceInput) => {
    if (!eventId) throw new Error("Event not found")
    const { error } = await createClient().from("event_spaces").insert({
      event_id: eventId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      capacity: input.capacity ?? null,
    })
    if (error) throw error
    await fetchAll()
  }, [eventId, fetchAll])

  const updateSpace = useCallback(async (spaceId: string, input: SpaceInput) => {
    const { error } = await createClient().from("event_spaces").update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      capacity: input.capacity ?? null,
    }).eq("id", spaceId)
    if (error) throw error
    await fetchAll()
  }, [fetchAll])

  const removeSpace = useCallback(async (spaceId: string) => {
    const { error } = await createClient().from("event_spaces").delete().eq("id", spaceId)
    if (error) throw error
    await fetchAll()
  }, [fetchAll])

  const createHuddle = useCallback(async (input: HuddleInput) => {
    if (!eventId || !userId) throw new Error("Check in first")
    if (input.spaceId) {
      const overlap = huddles.find((huddle) =>
        huddle.space_id === input.spaceId
        && huddle.status !== "cancelled"
        && new Date(huddle.starts_at) < new Date(input.endsAt)
        && new Date(input.startsAt) < new Date(huddle.ends_at),
      )
      if (overlap) throw new Error(`${overlap.space_name ?? "That space"} is already booked then.`)
    }
    const supabase = createClient()
    const { data, error } = await supabase.from("huddles").insert({
      event_id: eventId,
      space_id: input.spaceId,
      host_id: userId,
      topic: input.topic.trim(),
      kind: input.kind,
      welcome_skills: input.welcomeSkills,
      welcome_industries: input.welcomeIndustries,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
    }).select("id").single()
    if (error) throw error
    const { error: participantError } = await supabase.from("huddle_participants").insert({ huddle_id: data.id, user_id: userId })
    if (participantError) {
      await supabase.from("huddles").delete().eq("id", data.id)
      throw participantError
    }
    await fetchAll()
  }, [eventId, userId, huddles, fetchAll])

  const setHuddleStatus = useCallback(async (huddleId: string, status: Huddle["status"]) => {
    const { error } = await createClient().from("huddles").update({ status }).eq("id", huddleId)
    if (error) throw error
    await fetchAll()
  }, [fetchAll])

  const joinHuddle = useCallback(async (huddleId: string) => {
    if (!userId) throw new Error("Not authenticated")
    const { error } = await createClient().from("huddle_participants").insert({ huddle_id: huddleId, user_id: userId })
    if (error && error.code !== "23505") throw error
    await fetchAll()
  }, [userId, fetchAll])

  const leaveHuddle = useCallback(async (huddleId: string) => {
    if (!userId) return
    const { error } = await createClient().from("huddle_participants").delete().eq("huddle_id", huddleId).eq("user_id", userId)
    if (error) throw error
    await fetchAll()
  }, [userId, fetchAll])

  const queueDemo = useCallback(async (postId: string) => {
    if (!eventId || !userId) throw new Error("Not authenticated")
    const { error } = await createClient().from("event_demos").upsert({
      event_id: eventId,
      user_id: userId,
      post_id: postId,
      status: "queued",
      queued_at: new Date().toISOString(),
      presented_at: null,
    }, { onConflict: "event_id,user_id" })
    if (error) throw error
    await fetchAll()
  }, [eventId, userId, fetchAll])

  const unqueueDemo = useCallback(async () => {
    if (!myDemo) return
    const { error } = await createClient().from("event_demos").delete().eq("id", myDemo.id)
    if (error) throw error
    await fetchAll()
  }, [myDemo, fetchAll])

  const setDemoStatus = useCallback(async (demoId: string, status: EventDemo["status"]) => {
    const { error } = await createClient().from("event_demos").update({
      status,
      presented_at: status === "presented" ? new Date().toISOString() : null,
    }).eq("id", demoId)
    if (error) throw error
    await fetchAll()
  }, [fetchAll])

  const removeCheckin = useCallback(async (checkinId: string) => {
    const { error } = await createClient().from("event_checkins").delete().eq("id", checkinId)
    if (error) throw error
    await fetchAll()
  }, [fetchAll])

  return {
    checkins,
    activeCheckins,
    myCheckin,
    spaces,
    huddles,
    demos,
    myDemo,
    myShips,
    userId,
    loading,
    refresh: fetchAll,
    checkIn,
    checkOut,
    addFocusItem,
    toggleFocusItem,
    removeFocusItem,
    createSpace,
    updateSpace,
    removeSpace,
    createHuddle,
    setHuddleStatus,
    joinHuddle,
    leaveHuddle,
    queueDemo,
    unqueueDemo,
    setDemoStatus,
    removeCheckin,
  }
}
