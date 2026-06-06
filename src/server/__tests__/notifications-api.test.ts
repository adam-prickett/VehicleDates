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

import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { makeApp, post, get, put, del, extractCookie } from "./helpers.js";

const app = makeApp();

let fetchMock: ReturnType<typeof vi.fn>;
const originalFetch = global.fetch;

beforeEach(async () => {
  await db.delete(schema.notificationLog);
  await db.delete(schema.notificationChannels);
  await db.delete(schema.notificationPreferences);
  await db.delete(schema.vehicles);
  await db.delete(schema.users);

  fetchMock = vi.fn();
  // @ts-expect-error overriding global fetch for tests
  global.fetch = fetchMock;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

async function adminCookie() {
  const res = await post(app, "/auth/setup", { username: "admin", password: "password123" });
  return extractCookie(res);
}

async function secondUserCookie(admin: string, username = "bob") {
  await post(app, "/users", { username, password: "password123", role: "user" }, admin);
  const res = await post(app, "/auth/login", { username, password: "password123" });
  return extractCookie(res);
}

function ntfyChannel(over: Record<string, unknown> = {}) {
  return {
    type: "ntfy",
    label: "Home",
    config: { topic: "vehicle-alerts" },
    ...over,
  };
}

// ─── GET /providers ───────────────────────────────────────────────────────────

describe("GET /notifications/providers", () => {
  it("returns the registered provider list", async () => {
    const cookie = await adminCookie();
    const res = await get(app, "/notifications/providers", cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(expect.arrayContaining([{ type: "ntfy", label: "ntfy" }]));
  });

  it("requires auth", async () => {
    const res = await get(app, "/notifications/providers");
    expect(res.status).toBe(401);
  });
});

// ─── Preferences ──────────────────────────────────────────────────────────────

describe("GET /notifications/preferences", () => {
  it("creates and returns defaults for a new user", async () => {
    const cookie = await adminCookie();
    const res = await get(app, "/notifications/preferences", cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      enabled: false,
      leadDaysTax: [30, 7, 0],
      leadDaysMot: [30, 7, 0],
      leadDaysInsurance: [30, 7, 0],
      leadDaysService: [14, 0],
      sendHour: 9,
      sendMinute: 0,
      timezone: "Europe/London",
    });
  });

  it("is scoped per-user", async () => {
    const admin = await adminCookie();
    const bob = await secondUserCookie(admin);

    await put(
      app,
      "/notifications/preferences",
      {
        enabled: true,
        leadDaysTax: [60],
        leadDaysMot: [30, 7, 0],
        leadDaysInsurance: [30, 7, 0],
        leadDaysService: [14, 0],
        sendHour: 8,
        sendMinute: 30,
        timezone: "Europe/London",
      },
      admin
    );

    const bobPrefs = await (await get(app, "/notifications/preferences", bob)).json();
    expect(bobPrefs.enabled).toBe(false);
    expect(bobPrefs.leadDaysTax).toEqual([30, 7, 0]);
  });
});

describe("PUT /notifications/preferences", () => {
  it("upserts and returns the persisted values, deduped and sorted", async () => {
    const cookie = await adminCookie();
    const res = await put(
      app,
      "/notifications/preferences",
      {
        enabled: true,
        leadDaysTax: [7, 30, 0, 7],
        leadDaysMot: [0, 7],
        leadDaysInsurance: [30],
        leadDaysService: [],
        sendHour: 18,
        sendMinute: 30,
        timezone: "Europe/Berlin",
      },
      cookie
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.leadDaysTax).toEqual([0, 7, 30]);
    expect(body.leadDaysService).toEqual([]);
    expect(body.sendHour).toBe(18);
    expect(body.timezone).toBe("Europe/Berlin");
  });

  it("rejects an invalid sendHour", async () => {
    const cookie = await adminCookie();
    const res = await put(
      app,
      "/notifications/preferences",
      {
        enabled: false,
        leadDaysTax: [],
        leadDaysMot: [],
        leadDaysInsurance: [],
        leadDaysService: [],
        sendHour: 25,
        sendMinute: 0,
        timezone: "Europe/London",
      },
      cookie
    );
    expect(res.status).toBe(400);
  });

  it("rejects a negative or non-integer lead day", async () => {
    const cookie = await adminCookie();
    const res = await put(
      app,
      "/notifications/preferences",
      {
        enabled: false,
        leadDaysTax: [-1],
        leadDaysMot: [],
        leadDaysInsurance: [],
        leadDaysService: [],
        sendHour: 9,
        sendMinute: 0,
        timezone: "Europe/London",
      },
      cookie
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid timezone string", async () => {
    const cookie = await adminCookie();
    const res = await put(
      app,
      "/notifications/preferences",
      {
        enabled: true,
        leadDaysTax: [],
        leadDaysMot: [],
        leadDaysInsurance: [],
        leadDaysService: [],
        sendHour: 9,
        sendMinute: 0,
        timezone: "Not/AReal/Timezone",
      },
      cookie
    );
    expect(res.status).toBe(400);
  });
});

// ─── Channels ─────────────────────────────────────────────────────────────────

describe("POST /notifications/channels", () => {
  it("creates an ntfy channel with valid config", async () => {
    const cookie = await adminCookie();
    const res = await post(app, "/notifications/channels", ntfyChannel(), cookie);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      type: "ntfy",
      label: "Home",
      enabled: true,
      config: { topic: "vehicle-alerts", server: "https://ntfy.sh", authToken: null },
    });
    expect(body.id).toBeTypeOf("number");
  });

  it("rejects an unknown provider type", async () => {
    const cookie = await adminCookie();
    const res = await post(
      app,
      "/notifications/channels",
      { type: "made-up", label: "x", config: {} },
      cookie
    );
    expect(res.status).toBe(400);
  });

  it("rejects a config that fails the provider schema", async () => {
    const cookie = await adminCookie();
    const res = await post(
      app,
      "/notifications/channels",
      { type: "ntfy", label: "x", config: { topic: "has spaces" } },
      cookie
    );
    expect(res.status).toBe(400);
  });

  it("rejects when the label is empty", async () => {
    const cookie = await adminCookie();
    const res = await post(
      app,
      "/notifications/channels",
      { type: "ntfy", label: "", config: { topic: "x" } },
      cookie
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /notifications/channels", () => {
  it("lists only the caller's channels", async () => {
    const admin = await adminCookie();
    const bob = await secondUserCookie(admin);

    await post(app, "/notifications/channels", ntfyChannel({ label: "Admin's home" }), admin);
    await post(app, "/notifications/channels", ntfyChannel({ label: "Bob's phone" }), bob);

    const adminList = await (await get(app, "/notifications/channels", admin)).json();
    const bobList = await (await get(app, "/notifications/channels", bob)).json();

    expect(adminList).toHaveLength(1);
    expect(adminList[0].label).toBe("Admin's home");
    expect(bobList).toHaveLength(1);
    expect(bobList[0].label).toBe("Bob's phone");
  });
});

describe("PUT /notifications/channels/:id", () => {
  it("updates the label without revalidating the existing config", async () => {
    const cookie = await adminCookie();
    const created = await (
      await post(app, "/notifications/channels", ntfyChannel(), cookie)
    ).json();

    const res = await put(
      app,
      `/notifications/channels/${created.id}`,
      { label: "Renamed" },
      cookie
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.label).toBe("Renamed");
    expect(body.config.topic).toBe("vehicle-alerts");
  });

  it("revalidates when the config changes", async () => {
    const cookie = await adminCookie();
    const created = await (
      await post(app, "/notifications/channels", ntfyChannel(), cookie)
    ).json();

    const bad = await put(
      app,
      `/notifications/channels/${created.id}`,
      { config: { topic: "has spaces" } },
      cookie
    );
    expect(bad.status).toBe(400);

    const good = await put(
      app,
      `/notifications/channels/${created.id}`,
      { config: { topic: "new-topic", authToken: "tk_x" } },
      cookie
    );
    expect(good.status).toBe(200);
    const body = await good.json();
    expect(body.config).toMatchObject({ topic: "new-topic", authToken: "tk_x" });
  });

  it("returns 404 when another user owns the channel", async () => {
    const admin = await adminCookie();
    const bob = await secondUserCookie(admin);
    const created = await (
      await post(app, "/notifications/channels", ntfyChannel(), admin)
    ).json();

    const res = await put(
      app,
      `/notifications/channels/${created.id}`,
      { label: "stolen" },
      bob
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /notifications/channels/:id", () => {
  it("removes the channel", async () => {
    const cookie = await adminCookie();
    const created = await (
      await post(app, "/notifications/channels", ntfyChannel(), cookie)
    ).json();
    const res = await del(app, `/notifications/channels/${created.id}`, cookie);
    expect(res.status).toBe(200);
    const list = await (await get(app, "/notifications/channels", cookie)).json();
    expect(list).toHaveLength(0);
  });

  it("404s for a channel that belongs to another user", async () => {
    const admin = await adminCookie();
    const bob = await secondUserCookie(admin);
    const created = await (
      await post(app, "/notifications/channels", ntfyChannel(), admin)
    ).json();
    const res = await del(app, `/notifications/channels/${created.id}`, bob);
    expect(res.status).toBe(404);
  });
});

// ─── Test endpoint ────────────────────────────────────────────────────────────

describe("POST /notifications/channels/:id/test", () => {
  it("dispatches via the provider and returns success", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));

    const cookie = await adminCookie();
    const created = await (
      await post(app, "/notifications/channels", ntfyChannel(), cookie)
    ).json();

    const res = await post(app, `/notifications/channels/${created.id}/test`, {}, cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ntfy.sh/vehicle-alerts");
    expect(init.headers.Title).toContain("Test");
  });

  it("returns 502 with the upstream message when the provider rejects", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));

    const cookie = await adminCookie();
    const created = await (
      await post(app, "/notifications/channels", ntfyChannel(), cookie)
    ).json();

    const res = await post(app, `/notifications/channels/${created.id}/test`, {}, cookie);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("403");
  });

  it("404s for someone else's channel", async () => {
    const admin = await adminCookie();
    const bob = await secondUserCookie(admin);
    const created = await (
      await post(app, "/notifications/channels", ntfyChannel(), admin)
    ).json();
    const res = await post(app, `/notifications/channels/${created.id}/test`, {}, bob);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Log ──────────────────────────────────────────────────────────────────────

// ─── Run-now ──────────────────────────────────────────────────────────────────

describe("POST /notifications/run-now", () => {
  it("runs the per-user check immediately and returns a summary", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));

    const cookie = await adminCookie();
    await post(app, "/notifications/channels", ntfyChannel(), cookie);
    await put(
      app,
      "/notifications/preferences",
      {
        enabled: true,
        leadDaysTax: [],
        leadDaysMot: [30, 7, 0],
        leadDaysInsurance: [],
        leadDaysService: [],
        sendHour: 23, // not "now" — proves run-now ignores send-hour
        sendMinute: 0,
        timezone: "Europe/London",
      },
      cookie
    );

    const today = new Date();
    const upcoming = new Date(today);
    upcoming.setUTCDate(upcoming.getUTCDate() + 5);
    await post(
      app,
      "/vehicles",
      { registrationNumber: "AA11AAA" },
      cookie
    );
    // Set the MOT date via PUT so the vehicle now has an upcoming expiry
    const vehiclesList = await (await get(app, "/vehicles", cookie)).json();
    const v = vehiclesList[0];
    await put(
      app,
      `/vehicles/${v.id}`,
      { motExpiryDate: upcoming.toISOString().slice(0, 10) },
      cookie
    );

    const res = await post(app, "/notifications/run-now", {}, cookie);
    expect(res.status).toBe(200);
    const summary = await res.json();
    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns zeros when the user hasn't configured anything", async () => {
    const cookie = await adminCookie();
    const res = await post(app, "/notifications/run-now", {}, cookie);
    expect(res.status).toBe(200);
    const summary = await res.json();
    expect(summary).toMatchObject({ attempted: 0, sent: 0, failed: 0, skipped: 0 });
  });

  it("requires auth", async () => {
    const res = await post(app, "/notifications/run-now", {});
    expect(res.status).toBe(401);
  });
});

describe("GET /notifications/log", () => {
  it("returns the caller's own rows, newest first", async () => {
    const admin = await adminCookie();
    const bob = await secondUserCookie(admin);

    const adminMe = await (await get(app, "/auth/me", admin)).json();
    const bobMe = await (await get(app, "/auth/me", bob)).json();

    const adminChannel = await (
      await post(app, "/notifications/channels", ntfyChannel(), admin)
    ).json();
    const bobChannel = await (
      await post(app, "/notifications/channels", ntfyChannel(), bob)
    ).json();

    const created = await (
      await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, admin)
    ).json();

    await db.insert(schema.notificationLog).values([
      {
        userId: adminMe.id,
        vehicleId: created.id,
        eventType: "mot",
        eventDate: "2026-07-01",
        leadDays: 7,
        channelId: adminChannel.id,
        status: "sent",
        sentAt: "2026-06-01T09:00:00Z",
      },
      {
        userId: bobMe.id,
        vehicleId: created.id,
        eventType: "mot",
        eventDate: "2026-07-01",
        leadDays: 0,
        channelId: bobChannel.id,
        status: "failed",
        error: "ECONNRESET",
        sentAt: "2026-06-02T09:00:00Z",
      },
    ]);

    const adminLog = await (await get(app, "/notifications/log", admin)).json();
    const bobLog = await (await get(app, "/notifications/log", bob)).json();
    expect(adminLog).toHaveLength(1);
    expect(adminLog[0].status).toBe("sent");
    expect(bobLog).toHaveLength(1);
    expect(bobLog[0].status).toBe("failed");
  });
});
