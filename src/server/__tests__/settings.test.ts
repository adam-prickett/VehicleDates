import { describe, it, expect, beforeEach, vi } from "vitest";

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
  getEffectiveApiKey: vi.fn().mockResolvedValue("test-key-abcd1234"),
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
import { makeApp, post, get, extractCookie } from "./helpers.js";

const app = makeApp();

beforeEach(async () => {
  await db.delete(schema.vehicles);
  await db.delete(schema.users);
});

async function adminCookie() {
  const res = await post(app, "/auth/setup", { username: "admin", password: "password123" });
  return extractCookie(res);
}

async function userCookie(admin: string, username = "bob") {
  await post(app, "/users", { username, password: "password123", role: "user" }, admin);
  const res = await post(app, "/auth/login", { username, password: "password123" });
  return extractCookie(res);
}

// ─── GET /settings/dvla-key ───────────────────────────────────────────────────

describe("GET /settings/dvla-key", () => {
  it("returns 401 without auth", async () => {
    const res = await get(app, "/settings/dvla-key");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const admin = await adminCookie();
    const cookie = await userCookie(admin);
    const res = await get(app, "/settings/dvla-key", cookie);
    expect(res.status).toBe(403);
  });

  it("returns isSet and source for admin, but does NOT leak any hint of the key", async () => {
    const cookie = await adminCookie();
    const res = await get(app, "/settings/dvla-key", cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isSet).toBe(true);
    expect(body.source).toBe("environment");
    expect(body).not.toHaveProperty("hint");
    expect(JSON.stringify(body)).not.toContain("1234"); // last-4 of mocked key
  });
});

// ─── POST /settings/dvla-key ──────────────────────────────────────────────────

describe("POST /settings/dvla-key", () => {
  it("returns 403 for a non-admin", async () => {
    const admin = await adminCookie();
    const cookie = await userCookie(admin);
    const res = await post(app, "/settings/dvla-key", { apiKey: "fake" }, cookie);
    expect(res.status).toBe(403);
  });

  it("accepts a new key for admin", async () => {
    const cookie = await adminCookie();
    const res = await post(app, "/settings/dvla-key", { apiKey: "new-key" }, cookie);
    expect(res.status).toBe(200);
  });
});

// ─── GET /settings/export ─────────────────────────────────────────────────────

describe("GET /settings/export", () => {
  it("returns 403 for a non-admin", async () => {
    const admin = await adminCookie();
    const cookie = await userCookie(admin);
    const res = await get(app, "/settings/export", cookie);
    expect(res.status).toBe(403);
  });

  it("returns the export payload for admin", async () => {
    const cookie = await adminCookie();
    const res = await get(app, "/settings/export", cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("vehicles");
  });
});

// ─── POST /settings/import ────────────────────────────────────────────────────

describe("POST /settings/import", () => {
  it("returns 403 for a non-admin", async () => {
    const admin = await adminCookie();
    const cookie = await userCookie(admin);
    const res = await post(
      app,
      "/settings/import",
      { version: 1, vehicles: [{ registrationNumber: "AA11AAA" }] },
      cookie
    );
    expect(res.status).toBe(403);

    // Vehicle should NOT have been created
    const stillNone = await db.select().from(schema.vehicles);
    expect(stillNone).toHaveLength(0);
  });

  it("performs the import for admin", async () => {
    const cookie = await adminCookie();
    const res = await post(
      app,
      "/settings/import",
      { version: 1, vehicles: [{ registrationNumber: "AA11AAA" }] },
      cookie
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ imported: 1, updated: 0, total: 1 });
  });
});
