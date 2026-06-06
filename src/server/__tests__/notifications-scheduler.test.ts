import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("bcryptjs", () => ({
  default: {
    hash: async (pwd: string) => `hashed:${pwd}`,
    compare: async (pwd: string, hash: string) => hash === `hashed:${pwd}`,
  },
}));

vi.mock("../db/client.js", async () => {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const schema = await import("../db/schema.js");
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return { db };
});

vi.mock("../services/dvla.js", () => ({
  fetchDvlaVehicle: vi.fn().mockResolvedValue(null),
  getEffectiveApiKey: vi.fn().mockResolvedValue("test-key"),
  DvlaApiError: class DvlaApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import {
  dispatchNotificationsForUser,
  runScheduledCheck,
} from "../notifications/scheduler.js";
import { localHour } from "../notifications/timezone.js";

let fetchMock: ReturnType<typeof vi.fn>;
const originalFetch = global.fetch;

beforeEach(async () => {
  await db.delete(schema.notificationLog);
  await db.delete(schema.notificationChannels);
  await db.delete(schema.notificationPreferences);
  await db.delete(schema.vehicles);
  await db.delete(schema.users);

  fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
  // @ts-expect-error overriding global fetch for tests
  global.fetch = fetchMock;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

const NOW = new Date("2026-06-15T09:00:00Z");
function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function createUser(username = "alice") {
  const [u] = await db
    .insert(schema.users)
    .values({ username, passwordHash: "hashed:x", role: "admin" })
    .returning();
  return u;
}

async function createPrefs(
  userId: number,
  overrides: Partial<typeof schema.notificationPreferences.$inferInsert> = {}
) {
  await db.insert(schema.notificationPreferences).values({
    userId,
    enabled: true,
    leadDaysTax: "[30,7,0]",
    leadDaysMot: "[30,7,0]",
    leadDaysInsurance: "[30,7,0]",
    leadDaysService: "[14,0]",
    sendHour: 9,
    sendMinute: 0,
    timezone: "Europe/London",
    ...overrides,
  });
}

async function createChannel(
  userId: number,
  overrides: Partial<typeof schema.notificationChannels.$inferInsert> = {}
) {
  const [c] = await db
    .insert(schema.notificationChannels)
    .values({
      userId,
      type: "ntfy",
      label: "Test",
      config: JSON.stringify({
        server: "https://ntfy.sh",
        topic: "vehicle-alerts",
        authToken: null,
      }),
      enabled: true,
      ...overrides,
    })
    .returning();
  return c;
}

async function createVehicle(
  overrides: Partial<typeof schema.vehicles.$inferInsert> = {}
) {
  const [v] = await db
    .insert(schema.vehicles)
    .values({ registrationNumber: "AB12CDE", ...overrides })
    .returning();
  return v;
}

// ─── localHour ────────────────────────────────────────────────────────────────

describe("localHour", () => {
  it("returns the hour in the requested timezone", () => {
    const instant = new Date("2026-06-15T09:00:00Z"); // 10:00 local in London (BST)
    expect(localHour("Europe/London", instant)).toBe(10);
    expect(localHour("UTC", instant)).toBe(9);
    expect(localHour("America/New_York", instant)).toBe(5);
  });

  it("falls back to UTC hour for an invalid timezone", () => {
    const instant = new Date("2026-06-15T14:00:00Z");
    expect(localHour("Not/Real", instant)).toBe(14);
  });
});

// ─── dispatchNotificationsForUser ─────────────────────────────────────────────

describe("dispatchNotificationsForUser", () => {
  it("returns an empty summary when the user has no preferences", async () => {
    const u = await createUser();
    const summary = await dispatchNotificationsForUser(u.id, NOW);
    expect(summary).toMatchObject({ attempted: 0, sent: 0, failed: 0, skipped: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when preferences are disabled", async () => {
    const u = await createUser();
    await createPrefs(u.id, { enabled: false });
    await createChannel(u.id);
    await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 3) });
    const summary = await dispatchNotificationsForUser(u.id, NOW);
    expect(summary.sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no enabled channels", async () => {
    const u = await createUser();
    await createPrefs(u.id);
    await createChannel(u.id, { enabled: false });
    await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 3) });
    const summary = await dispatchNotificationsForUser(u.id, NOW);
    expect(summary.sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one notification and writes a 'sent' log row on success", async () => {
    const u = await createUser();
    await createPrefs(u.id);
    const ch = await createChannel(u.id);
    const v = await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 5) });

    const summary = await dispatchNotificationsForUser(u.id, NOW);

    expect(summary).toMatchObject({ attempted: 1, sent: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ntfy.sh/vehicle-alerts");
    expect(init.headers.Title).toContain("MOT");

    const logs = await db
      .select()
      .from(schema.notificationLog)
      .where(/*eq filter omitted — only one row*/ undefined as never);
    const rows = await db.select().from(schema.notificationLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: u.id,
      vehicleId: v.id,
      eventType: "mot",
      leadDays: 7,
      channelId: ch.id,
      status: "sent",
    });
    void logs;
  });

  it("records 'failed' (with error) when the provider rejects, and counts it for retry", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));

    const u = await createUser();
    await createPrefs(u.id);
    await createChannel(u.id);
    await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 5) });

    const summary = await dispatchNotificationsForUser(u.id, NOW);
    expect(summary).toMatchObject({ attempted: 1, sent: 0, failed: 1 });
    expect(summary.errors[0].message).toContain("500");

    const rows = await db.select().from(schema.notificationLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
    expect(rows[0].error).toContain("500");

    // Failures are NOT dedupe: a second run still tries again
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const retry = await dispatchNotificationsForUser(u.id, NOW);
    expect(retry.sent).toBe(1);
  });

  it("dedupes by (vehicle, event, eventDate, leadDays, channel) — a 'sent' row blocks re-send", async () => {
    const u = await createUser();
    await createPrefs(u.id);
    await createChannel(u.id);
    const v = await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 5) });

    await dispatchNotificationsForUser(u.id, NOW);
    fetchMock.mockClear();

    const second = await dispatchNotificationsForUser(u.id, NOW);
    expect(second.attempted).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    void v;
  });

  it("dedupes per-channel — adding a new channel still receives the alert", async () => {
    const u = await createUser();
    await createPrefs(u.id);
    const homeChannel = await createChannel(u.id, { label: "Home" });
    await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 5) });

    // First run with one channel
    await dispatchNotificationsForUser(u.id, NOW);
    fetchMock.mockClear();

    // Add a second channel and run again — the original Home channel is deduped,
    // the new Phone channel fires fresh
    await createChannel(u.id, { label: "Phone" });
    const second = await dispatchNotificationsForUser(u.id, NOW);
    expect(second.sent).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();

    const logs = await db.select().from(schema.notificationLog);
    expect(logs).toHaveLength(2);
    expect(new Set(logs.map((l) => l.channelId)).size).toBe(2);
    void homeChannel;
  });

  it("dispatches one notification per (event × channel) when there are multiple of each", async () => {
    const u = await createUser();
    await createPrefs(u.id);
    await createChannel(u.id, { label: "Home" });
    await createChannel(u.id, { label: "Phone" });
    await createVehicle({
      registrationNumber: "AA11AAA",
      motExpiryDate: addDays(NOW.toISOString(), 5),
      taxDueDate: addDays(NOW.toISOString(), 5),
    });

    const summary = await dispatchNotificationsForUser(u.id, NOW);
    // 2 events × 2 channels = 4 sends
    expect(summary.sent).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("skips planned notifications when the channel's stored config no longer validates", async () => {
    const u = await createUser();
    await createPrefs(u.id);
    await createChannel(u.id, { config: JSON.stringify({ topic: "" }) }); // invalid
    await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 5) });

    const summary = await dispatchNotificationsForUser(u.id, NOW);
    expect(summary.skipped).toBe(1);
    expect(summary.sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops retrying after 3 consecutive failures for the same dedupe key", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));

    const u = await createUser();
    await createPrefs(u.id);
    await createChannel(u.id);
    await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 5) });

    for (let i = 0; i < 3; i++) {
      const s = await dispatchNotificationsForUser(u.id, NOW);
      expect(s.failed).toBe(1);
    }

    // 4th run: cap reached, no further attempt
    fetchMock.mockClear();
    const fourth = await dispatchNotificationsForUser(u.id, NOW);
    expect(fourth.attempted).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();

    const rows = await db.select().from(schema.notificationLog);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === "failed")).toBe(true);
  });

  it("resets the retry cap implicitly when the underlying date is renewed", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));

    const u = await createUser();
    await createPrefs(u.id);
    await createChannel(u.id);
    const v = await createVehicle({
      motExpiryDate: addDays(NOW.toISOString(), 5),
    });

    // Burn through the cap on the old date
    for (let i = 0; i < 3; i++) {
      await dispatchNotificationsForUser(u.id, NOW);
    }
    fetchMock.mockClear();
    expect((await dispatchNotificationsForUser(u.id, NOW)).attempted).toBe(0);

    // Renew the MOT date — different key, fresh attempts allowed
    await db
      .update(schema.vehicles)
      .set({ motExpiryDate: addDays(NOW.toISOString(), 7) })
      .where(eq(schema.vehicles.id, v.id));
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const after = await dispatchNotificationsForUser(u.id, NOW);
    expect(after.sent).toBe(1);
  });

  it("includes a Click header pointing at the vehicle when PUBLIC_BASE_URL is set", async () => {
    process.env.PUBLIC_BASE_URL = "https://vehicles.example.com/";
    try {
      const u = await createUser();
      await createPrefs(u.id);
      await createChannel(u.id);
      const v = await createVehicle({
        motExpiryDate: addDays(NOW.toISOString(), 5),
      });

      await dispatchNotificationsForUser(u.id, NOW);
      expect(fetchMock.mock.calls[0][1].headers.Click).toBe(
        `https://vehicles.example.com/vehicles/${v.id}`
      );
    } finally {
      delete process.env.PUBLIC_BASE_URL;
    }
  });

  it("omits the Click header when PUBLIC_BASE_URL is unset", async () => {
    delete process.env.PUBLIC_BASE_URL;
    const u = await createUser();
    await createPrefs(u.id);
    await createChannel(u.id);
    await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 5) });

    await dispatchNotificationsForUser(u.id, NOW);
    expect(fetchMock.mock.calls[0][1].headers.Click).toBeUndefined();
  });

  it("uses 'high' priority for events that are 0 days away or overdue", async () => {
    const u = await createUser();
    await createPrefs(u.id);
    await createChannel(u.id);
    await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 0) });

    await dispatchNotificationsForUser(u.id, NOW);
    expect(fetchMock.mock.calls[0][1].headers.Priority).toBe("4"); // high
  });
});

// ─── runScheduledCheck ────────────────────────────────────────────────────────

describe("pruneNotificationLog", () => {
  it("removes only rows older than 180 days", async () => {
    const { pruneNotificationLog } = await import("../jobs/notifications.js");
    const u = await createUser();
    await createPrefs(u.id);
    const channel = await createChannel(u.id);
    const vehicle = await createVehicle();

    const now = new Date("2026-06-15T09:00:00Z");
    const old = new Date(now.getTime() - 181 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.insert(schema.notificationLog).values([
      {
        userId: u.id,
        vehicleId: vehicle.id,
        eventType: "mot",
        eventDate: "2025-06-01",
        leadDays: 0,
        channelId: channel.id,
        status: "sent",
        sentAt: old,
      },
      {
        userId: u.id,
        vehicleId: vehicle.id,
        eventType: "mot",
        eventDate: "2026-06-01",
        leadDays: 0,
        channelId: channel.id,
        status: "sent",
        sentAt: recent,
      },
    ]);

    const removed = await pruneNotificationLog(now);
    expect(removed).toBe(1);
    const remaining = await db.select().from(schema.notificationLog);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].sentAt).toBe(recent);
  });

  it("is a no-op when nothing's old enough", async () => {
    const { pruneNotificationLog } = await import("../jobs/notifications.js");
    const removed = await pruneNotificationLog();
    expect(removed).toBe(0);
  });
});

describe("runScheduledCheck", () => {
  it("processes only users whose local hour matches their sendHour", async () => {
    // NOW is 2026-06-15T09:00:00Z. In BST that's 10:00 in Europe/London.
    const matchUser = await createUser("alice");
    const skipUser = await createUser("bob");

    await createPrefs(matchUser.id, { timezone: "Europe/London", sendHour: 10 });
    await createPrefs(skipUser.id, { timezone: "Europe/London", sendHour: 8 });

    await createChannel(matchUser.id);
    await createChannel(skipUser.id);
    await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 5) });

    const summaries = await runScheduledCheck(NOW);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].userId).toBe(matchUser.id);
    expect(summaries[0].sent).toBe(1);
  });

  it("skips users with preferences.enabled = false even if their hour matches", async () => {
    const u = await createUser();
    await createPrefs(u.id, { enabled: false, timezone: "UTC", sendHour: 9 });
    await createChannel(u.id);
    await createVehicle({ motExpiryDate: addDays(NOW.toISOString(), 5) });

    const summaries = await runScheduledCheck(NOW);
    expect(summaries).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an empty array when there are no users", async () => {
    const summaries = await runScheduledCheck(NOW);
    expect(summaries).toEqual([]);
  });
});
