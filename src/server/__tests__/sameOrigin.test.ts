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
import { makeApp, post, get, extractCookie } from "./helpers.js";

const app = makeApp();

beforeEach(async () => {
  await db.delete(schema.vehicles);
  await db.delete(schema.users);
  delete process.env.ALLOWED_ORIGINS;
});

afterEach(() => {
  delete process.env.ALLOWED_ORIGINS;
});

async function adminCookie() {
  const res = await post(app, "/auth/setup", { username: "admin", password: "password123" });
  return extractCookie(res);
}

describe("Same-origin (CSRF) middleware", () => {
  it("rejects state-changing requests with no Origin or Referer header", async () => {
    const res = await app.request("/auth/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Origin header required for state-changing requests",
    });
  });

  it("rejects state-changing requests from a foreign Origin", async () => {
    const res = await app.request("/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example.com",
      },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/origin/i);
  });

  it("accepts same-origin POSTs", async () => {
    const res = await app.request("/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(res.status).toBe(201);
  });

  it("falls back to Referer when Origin is missing", async () => {
    const res = await app.request("/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        referer: "http://localhost/login",
      },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(res.status).toBe(201);
  });

  it("rejects a malformed Origin header", async () => {
    const res = await app.request("/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "not a url",
      },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(res.status).toBe(403);
  });

  it("allows the Vite dev origin in development", async () => {
    const res = await app.request("/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(res.status).toBe(201);
  });

  it("does NOT enforce the check on GET requests", async () => {
    // Anonymous GET should hit auth check (401), not CSRF (403)
    const res = await app.request("/vehicles", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("honours ALLOWED_ORIGINS env var when set", async () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";

    const bad = await app.request("/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(bad.status).toBe(403);

    const good = await app.request("/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://app.example.com",
      },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(good.status).toBe(201);
  });

  it("rejects a cross-origin DELETE even with a valid cookie", async () => {
    const cookie = await adminCookie();
    const createRes = await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie);
    const { id } = await createRes.json();

    const cross = await app.request(`/vehicles/${id}`, {
      method: "DELETE",
      headers: {
        cookie,
        origin: "https://evil.example.com",
      },
    });
    expect(cross.status).toBe(403);

    // Verify the vehicle is still there
    const stillExists = await get(app, `/vehicles/${id}`, cookie);
    expect(stillExists.status).toBe(200);
  });
});
