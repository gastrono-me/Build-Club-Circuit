import { expect, test, type Page } from "@playwright/test"
import { authenticatedPage } from "./auth"

const MAIN_SLUG = "e2e-live-coworking"
const CAPACITY_SLUG = "e2e-capacity-race"
const MAIN_NAME = "E2E Live Coworking"
const HUDDLE_TOPIC = "E2E feedback huddle"
const SHIP_NOTE = "E2E ship: durable coworking flow"
const EVENT_NAMES: Record<string, string> = {
  [MAIN_SLUG]: MAIN_NAME,
  [CAPACITY_SLUG]: "E2E Capacity Race",
}

async function joinEvent(page: Page, slug: string) {
  await page.goto(`/events/${slug}`)
  await expect(page.getByRole("heading", { level: 1, name: EVENT_NAMES[slug], exact: true })).toBeVisible()
  const button = page.getByRole("button", { name: "Join", exact: true }).first()
  await button.click()
  await expect(page.getByRole("button", { name: "Joined", exact: true })).toBeVisible()
}

async function fillCheckIn(page: Page, intention: string) {
  await page.getByLabel("This session I want to…").fill(intention)
  await page.getByRole("button", { name: "Check in", exact: true }).click()
}

test.describe.serial("non-production coworking release gate", () => {
  test("protects signed-out and staff-only routes", async ({ browser, page }) => {
    await page.goto(`/events/${MAIN_SLUG}`)
    await expect(page).toHaveURL(/\/$/)

    const builder = await authenticatedPage(browser, "BUILDER")
    await builder.page.goto("/admin")
    await expect(builder.page).toHaveURL(/\/events$/)
    await builder.context.close()
  })

  test("builder completes the durable coworking journey", async ({ browser }) => {
    const { context, page } = await authenticatedPage(browser, "BUILDER")
    await joinEvent(page, MAIN_SLUG)
    await page.getByLabel("This session I want to…").fill("Validate the full non-production coworking journey")
    await page.getByPlaceholder("Outcome 1").fill("Prove the release gate")
    await page.getByRole("button", { name: "Check in", exact: true }).click()
    await expect(page.getByText("Checked in", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Joined", exact: true }).click()
    await expect(page.getByText("Check out before leaving this event.")).toBeVisible()

    await page.getByRole("button", { name: "Huddle", exact: true }).click()
    await page.getByLabel("Topic").fill(HUDDLE_TOPIC)
    await page.getByLabel("Space").selectOption({ label: "E2E Focus Room" })
    await page.getByRole("button", { name: "Book 15 min" }).click()
    await expect(page.getByText(HUDDLE_TOPIC, { exact: true })).toBeVisible()

    await page.goto("/home")
    await page.getByPlaceholder("Brief description: what did you just get working?").fill(SHIP_NOTE)
    await expect(page.getByText(`Count this toward ${MAIN_NAME}`)).toBeVisible()
    await page.getByRole("button", { name: "Post update" }).click()
    // A click only starts the async Supabase mutation. Wait for the composer to
    // clear (the durable-success signal) before navigating away, then verify the
    // saved ship is rendered outside the form.
    await expect(page.getByPlaceholder("Brief description: what did you just get working?")).toBeEmpty()
    await expect(page.getByRole("region", { name: "Shipped today" }).getByText(SHIP_NOTE, { exact: true })).toBeVisible()

    await page.goto(`/events/${MAIN_SLUG}`)
    await page.getByLabel("Ship for lightning demo").selectOption({ label: SHIP_NOTE })
    await page.getByRole("button", { name: "Join queue" }).click()
    await expect(page.getByText("queued", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Check out", exact: true }).click()
    await expect(page.getByText("Check in to E2E Live Coworking")).toBeVisible()
    await page.getByRole("button", { name: "Joined", exact: true }).click()
    await expect(page.getByRole("button", { name: "Join", exact: true }).first()).toBeVisible()
    await context.close()
  })

  test("database locks allow only one final event slot", async ({ browser }) => {
    const admin = await authenticatedPage(browser, "ADMIN")
    const builder = await authenticatedPage(browser, "BUILDER")
    await Promise.all([joinEvent(admin.page, CAPACITY_SLUG), joinEvent(builder.page, CAPACITY_SLUG)])
    await admin.page.getByLabel("This session I want to…").fill("Take the final admin slot")
    await builder.page.getByLabel("This session I want to…").fill("Take the final builder slot")
    await Promise.all([
      admin.page.getByRole("button", { name: "Check in", exact: true }).click(),
      builder.page.getByRole("button", { name: "Check in", exact: true }).click(),
    ])

    // Both form handlers continue asynchronously after the browser clicks.
    // Poll until the database-serialized outcome is rendered on one page.
    await expect.poll(async () => {
      const [adminWon, builderWon] = await Promise.all([
        admin.page.getByText("Checked in", { exact: true }).isVisible(),
        builder.page.getByText("Checked in", { exact: true }).isVisible(),
      ])
      return Number(adminWon) + Number(builderWon)
    }).toBe(1)
    const adminWon = await admin.page.getByText("Checked in", { exact: true }).isVisible()
    const loser = adminWon ? builder.page : admin.page
    await expect(loser.getByText(/at (its 1-builder )?capacity/i)).toBeVisible()
    await admin.context.close()
    await builder.context.close()
  })

  test("staff can operate, moderate, and preserve event lifecycle", async ({ browser }) => {
    const { context, page } = await authenticatedPage(browser, "ADMIN")
    await joinEvent(page, MAIN_SLUG)
    await fillCheckIn(page, "Validate staff operations")
    await expect(page.getByText("Checked in", { exact: true })).toBeVisible()

    const huddle = page.getByTestId("huddle-card").filter({ hasText: HUDDLE_TOPIC })
    await huddle.getByRole("button", { name: "Join", exact: true }).click()
    await expect(page.getByRole("alert").filter({ hasText: "huddle space is at capacity" })).toBeVisible()

    await page.goto(`/events/${MAIN_SLUG}/board`)
    await expect(page.getByRole("heading", { name: MAIN_NAME })).toBeVisible()
    await expect(page.getByText("Lightning demos")).toBeVisible()

    await page.goto("/admin")
    const eventCard = page.getByTestId(`admin-event-${MAIN_SLUG}`)
    await expect(eventCard).toContainText(MAIN_NAME)
    page.once("dialog", (dialog) => dialog.accept())
    await eventCard.getByRole("button", { name: "Cancel event" }).click()
    await expect(eventCard).toContainText("Cancelled")

    await page.goto(`/events/${MAIN_SLUG}`)
    await expect(page.getByText("This event was cancelled. Live coworking is closed.")).toBeVisible()

    await page.goto("/admin")
    const cancelledCard = page.getByTestId(`admin-event-${MAIN_SLUG}`)
    page.once("dialog", (dialog) => dialog.accept())
    await cancelledCard.getByRole("button", { name: "Archive" }).click()
    await expect(cancelledCard).toContainText("Archived")

    page.once("dialog", (dialog) => dialog.accept())
    await cancelledCard.getByRole("button", { name: "Restore" }).click()
    await expect(cancelledCard).toContainText("Cancelled")
    page.once("dialog", (dialog) => dialog.accept())
    await cancelledCard.getByRole("button", { name: "Reopen" }).click()
    await expect(cancelledCard).toContainText("Live")
    await context.close()
  })

  test("event journey remains usable at 390px", async ({ browser }) => {
    const { context, page } = await authenticatedPage(browser, "BUILDER", { width: 390, height: 844 })
    await page.goto(`/events/${MAIN_SLUG}`)
    await expect(page.getByRole("heading", { name: MAIN_NAME })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
    await context.close()
  })
})
