import { describe, it, expect, vi, beforeEach } from "vitest"

// A fake Supabase client whose channels record what happens to them.
const channels: FakeChannel[] = []

class FakeChannel {
  topic: string
  handler: (() => void) | null = null
  sent: any[] = []
  removed = false
  subscribed = false
  constructor(topic: string) {
    this.topic = topic
    channels.push(this)
  }
  on(_type: string, _filter: any, cb: () => void) {
    this.handler = cb
    return this
  }
  subscribe(cb?: (status: string) => void) {
    this.subscribed = true
    cb?.("SUBSCRIBED")
    return this
  }
  send(msg: any) {
    this.sent.push(msg)
    return Promise.resolve("ok")
  }
}

const fakeSupabase = {
  channel: (topic: string) => new FakeChannel(topic),
  removeChannel: (ch: FakeChannel) => {
    ch.removed = true
  },
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => fakeSupabase,
}))

import {
  subscribeFeed,
  notifyFeed,
  __resetFeedBus,
  BUILD_LOG_TOPIC,
} from "@/lib/realtime/feedBus"

beforeEach(() => {
  __resetFeedBus()
  channels.length = 0
})

describe("feedBus", () => {
  it("opens exactly one channel per topic across multiple subscribers", () => {
    const a = vi.fn()
    const b = vi.fn()
    subscribeFeed(BUILD_LOG_TOPIC, a)
    subscribeFeed(BUILD_LOG_TOPIC, b)
    // One shared channel, not one per listener.
    const live = channels.filter((c) => c.topic === BUILD_LOG_TOPIC && !c.removed)
    expect(live).toHaveLength(1)
  })

  it("fans a changed ping out to every listener", () => {
    const a = vi.fn()
    const b = vi.fn()
    subscribeFeed(BUILD_LOG_TOPIC, a)
    subscribeFeed(BUILD_LOG_TOPIC, b)
    // Simulate a broadcast arriving on the shared channel.
    channels[0].handler!()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it("keeps the channel until the last listener leaves", () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = subscribeFeed(BUILD_LOG_TOPIC, a)
    const offB = subscribeFeed(BUILD_LOG_TOPIC, b)
    const ch = channels[0]
    offA()
    expect(ch.removed).toBe(false) // b still listening
    offB()
    expect(ch.removed).toBe(true) // now closed
  })

  it("stops delivering to a listener after it unsubscribes", () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = subscribeFeed(BUILD_LOG_TOPIC, a)
    subscribeFeed(BUILD_LOG_TOPIC, b)
    offA()
    channels[0].handler!()
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })

  it("notifyFeed sends a changed ping on the live channel", () => {
    const local = vi.fn()
    subscribeFeed(BUILD_LOG_TOPIC, local)
    notifyFeed(BUILD_LOG_TOPIC)
    expect(local).toHaveBeenCalledTimes(1)
    expect(channels[0].sent).toEqual([{ type: "broadcast", event: "changed", payload: {} }])
  })

  it("notifyFeed with no live listener opens a transient channel, sends, and drops it", async () => {
    notifyFeed(BUILD_LOG_TOPIC)
    const ch = channels[channels.length - 1]
    expect(ch.sent).toEqual([{ type: "broadcast", event: "changed", payload: {} }])
    // Cleanup runs in the send().finally() microtask.
    await Promise.resolve()
    expect(ch.removed).toBe(true)
  })

  it("reopens a channel after the topic was fully released", () => {
    const off = subscribeFeed(BUILD_LOG_TOPIC, vi.fn())
    off()
    subscribeFeed(BUILD_LOG_TOPIC, vi.fn())
    const live = channels.filter((c) => c.topic === BUILD_LOG_TOPIC && !c.removed)
    expect(live).toHaveLength(1)
  })
})
