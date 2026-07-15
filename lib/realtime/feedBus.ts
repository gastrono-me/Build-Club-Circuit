"use client"

import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

/**
 * Shared "a feed changed" notification bus, built on Supabase Broadcast.
 *
 * Why broadcast instead of postgres_changes: postgres_changes evaluates every
 * subscriber's RLS on every row change and runs through a single replication
 * slot, so its cost is O(changes x subscribers) and it tops out in the low
 * hundreds of concurrent clients. Broadcast authorizes once at join and fans a
 * message out at the realtime layer, which is what Supabase recommends past a
 * few hundred subscribers.
 *
 * The messages here are content-free pings ("changed"): a writer tells everyone
 * a table moved, and each client refetches with its own RLS-protected, scoped
 * query. No row data ever travels over the channel.
 *
 * One channel per topic per browser (Phoenix allows only one channel per topic
 * per socket), ref-counted across all hook instances so mounting the same feed
 * twice shares a single subscription instead of colliding.
 */

/** Topic for the build_log (ship) feed and its cheers. */
export const BUILD_LOG_TOPIC = "feed:build_log"
/** Topic for the blockers (radar) feed and its me-toos. */
export const BLOCKERS_TOPIC = "feed:blockers"

interface Entry {
  channel: RealtimeChannel
  listeners: Set<() => void>
}

const registry = new Map<string, Entry>()

/**
 * Listen for "changed" pings on a topic. Returns an unsubscribe function.
 * The first listener for a topic opens the channel; the last one to leave
 * closes it.
 */
export function subscribeFeed(topic: string, onChanged: () => void): () => void {
  let entry = registry.get(topic)
  if (!entry) {
    const channel = createClient().channel(topic)
    const created: Entry = { channel, listeners: new Set() }
    channel
      .on("broadcast", { event: "changed" }, () => {
        for (const fn of created.listeners) fn()
      })
      .subscribe()
    registry.set(topic, created)
    entry = created
  }
  entry.listeners.add(onChanged)

  return () => {
    const e = registry.get(topic)
    if (!e) return
    e.listeners.delete(onChanged)
    if (e.listeners.size === 0) {
      createClient().removeChannel(e.channel)
      registry.delete(topic)
    }
  }
}

/**
 * Tell every client on a topic that the table changed. Supabase Broadcast does
 * not echo to the sender by default, so notify local listeners directly before
 * sending the cross-client ping.
 */
export function notifyFeed(topic: string): void {
  const entry = registry.get(topic)
  if (entry) {
    for (const fn of entry.listeners) fn()
    entry.channel.send({ type: "broadcast", event: "changed", payload: {} })
    return
  }
  // No local listener (writing from a surface without the feed mounted): open a
  // transient channel just long enough to send, then drop it.
  const supabase = createClient()
  const channel = supabase.channel(topic)
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      channel
        .send({ type: "broadcast", event: "changed", payload: {} })
        .finally(() => supabase.removeChannel(channel))
    }
  })
}

/** Test-only: drop all channels and listeners. */
export function __resetFeedBus(): void {
  for (const [, e] of registry) createClient().removeChannel(e.channel)
  registry.clear()
}
