import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock bcryptjs so tests run fast (no 100ms hashing)
vi.mock("bcryptjs", () => ({
  default: {
    hash: async (pwd: string) => `hashed:${pwd}`,
    compare: async (pwd: string, hash: string) => hash === `hashed:${pwd}`,
  },
}));

// Set up an isolated in-memory DB for this test file
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

import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { makeApp, post, get, extractCookie } from "./helpers.js";

const app = makeApp();

async function clearDb() {
  await db.delete(schema.users);
  await db.delete(schema.vehicles);
}

beforeEach(clearDb);

// ─── Setup ────────────────────────────────────────────────────────────────────

describe("GET /auth/setup", () => {
  it("returns needed:true when no users exist", async () => {
    const res = await get(app, "/auth/setup");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ needed: true });
  });

  it("returns needed:false after an admin is created", async () => {
    await post(app, "/auth/setup", { username: "admin", password: "password123" });
    const res = await get(app, "/auth/setup");
    expect((await res.json()).needed).toBe(false);
  });
});

describe("POST /auth/setup", () => {
  it("creates the first admin and returns user data", async () => {
    const res = await post(app, "/auth/setup", { username: "admin", password: "password123" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.username).toBe("admin");
    expect(body.role).toBe("admin");
    expect(body.id).toBeTypeOf("number");
  });

  it("sets an auth_token cookie", async () => {
    const res = await post(app, "/auth/setup", { username: "admin", password: "password123" });
    expect(res.headers.get("set-cookie")).toMatch(/auth_token=/);
  });

  it("returns 409 if setup has already been completed", async () => {
    await post(app, "/auth/setup", { username: "admin", password: "password123" });
    const res = await post(app, "/auth/setup", { username: "admin2", password: "password456" });
    expect(res.status).toBe(409);
  });

  it("returns 400 for username shorter than 3 characters", async () => {
    const res = await post(app, "/auth/setup", { username: "ab", password: "password123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for password shorter than 8 characters", async () => {
    const res = await post(app, "/auth/setup", { username: "admin", password: "short" });
    expect(res.status).toBe(400);
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await post(app, "/auth/setup", { username: "alice", password: "password123" });
  });

  it("returns user data and sets cookie for valid credentials", async () => {
    const res = await post(app, "/auth/login", { username: "alice", password: "password123" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe("alice");
    expect(res.headers.get("set-cookie")).toMatch(/auth_token=/);
  });

  it("returns 401 for wrong password", async () => {
    const res = await post(app, "/auth/login", { username: "alice", password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for unknown username", async () => {
    const res = await post(app, "/auth/login", { username: "nobody", password: "password123" });
    expect(res.status).toBe(401);
  });

  it("returns the same error message for wrong password and unknown user", async () => {
    const wrongPwd = await post(app, "/auth/login", { username: "alice", password: "bad" });
    const noUser = await post(app, "/auth/login", { username: "ghost", password: "password123" });
    const a = await wrongPwd.json();
    const b = await noUser.json();
    expect(a.error).toBe(b.error);
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

describe("POST /auth/logout", () => {
  it("clears the auth_token cookie", async () => {
    const res = await post(app, "/auth/logout", {});
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    // Cookie should be cleared (max-age=0 or expires in the past)
    expect(setCookie).toMatch(/auth_token=;|auth_token=(?:;|$)/);
  });
});

// ─── Me ───────────────────────────────────────────────────────────────────────

describe("GET /auth/me", () => {
  it("returns the current user when authenticated", async () => {
    const setup = await post(app, "/auth/setup", { username: "alice", password: "password123" });
    const cookie = extractCookie(setup);

    const res = await get(app, "/auth/me", cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe("alice");
    expect(body.role).toBe("admin");
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("returns 401 with no cookie", async () => {
    const res = await get(app, "/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an invalid token", async () => {
    const res = await get(app, "/auth/me", "auth_token=not.a.real.token");
    expect(res.status).toBe(401);
  });
});
