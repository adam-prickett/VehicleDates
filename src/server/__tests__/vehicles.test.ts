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

// Prevent real DVLA calls; background refresh is fire-and-forget anyway
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

async function clearDb() {
  await db.delete(schema.vehicles);
  await db.delete(schema.users);
}

beforeEach(clearDb);

async function adminCookie() {
  const res = await post(app, "/auth/setup", { username: "admin", password: "password123" });
  return extractCookie(res);
}

// ─── Create vehicle ───────────────────────────────────────────────────────────

describe("POST /vehicles", () => {
  it("creates a vehicle and returns 201", async () => {
    const cookie = await adminCookie();
    const res = await post(app, "/vehicles", { registrationNumber: "AB12 CDE" }, cookie);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.registrationNumber).toBe("AB12CDE");
  });

  it("normalises registration: strips spaces and uppercases", async () => {
    const cookie = await adminCookie();
    const res = await post(app, "/vehicles", { registrationNumber: " ab12 cde " }, cookie);
    expect((await res.json()).registrationNumber).toBe("AB12CDE");
  });

  it("returns 409 for a duplicate registration", async () => {
    const cookie = await adminCookie();
    await post(app, "/vehicles", { registrationNumber: "AB12CDE" }, cookie);
    const res = await post(app, "/vehicles", { registrationNumber: "AB12CDE" }, cookie);
    expect(res.status).toBe(409);
  });

  it("returns 401 without auth", async () => {
    const res = await post(app, "/vehicles", { registrationNumber: "AB12CDE" });
    expect(res.status).toBe(401);
  });

  it("saves optional fields", async () => {
    const cookie = await adminCookie();
    const res = await post(app, "/vehicles", {
      registrationNumber: "AB12CDE",
      model: "Golf GTI",
      notes: "My car",
    }, cookie);
    const body = await res.json();
    expect(body.model).toBe("Golf GTI");
    expect(body.notes).toBe("My car");
  });
});

// ─── List vehicles ────────────────────────────────────────────────────────────

describe("GET /vehicles", () => {
  it("returns only active (non-archived) vehicles by default", async () => {
    const cookie = await adminCookie();
    const createRes = await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie);
    const { id } = await createRes.json();
    await post(app, "/vehicles", { registrationNumber: "BB22BBB" }, cookie);

    // Archive one
    await post(app, `/vehicles/${id}/archive`, { reason: "sold" }, cookie);

    const res = await get(app, "/vehicles", cookie);
    const list = await res.json();
    expect(list).toHaveLength(1);
    expect(list[0].registrationNumber).toBe("BB22BBB");
  });

  it("returns archived vehicles with ?archived=true", async () => {
    const cookie = await adminCookie();
    const createRes = await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie);
    const { id } = await createRes.json();
    await post(app, `/vehicles/${id}/archive`, { reason: "scrapped" }, cookie);

    const res = await get(app, "/vehicles?archived=true", cookie);
    const list = await res.json();
    expect(list).toHaveLength(1);
    expect(list[0].registrationNumber).toBe("AA11AAA");
  });
});

// ─── Get single vehicle ───────────────────────────────────────────────────────

describe("GET /vehicles/:id", () => {
  it("returns the vehicle", async () => {
    const cookie = await adminCookie();
    const createRes = await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie);
    const { id } = await createRes.json();

    const res = await get(app, `/vehicles/${id}`, cookie);
    expect(res.status).toBe(200);
    expect((await res.json()).registrationNumber).toBe("AA11AAA");
  });

  it("returns 404 for unknown id", async () => {
    const cookie = await adminCookie();
    const res = await get(app, "/vehicles/99999", cookie);
    expect(res.status).toBe(404);
  });
});

// ─── Update vehicle ───────────────────────────────────────────────────────────

describe("PUT /vehicles/:id", () => {
  it("updates user-editable fields", async () => {
    const cookie = await adminCookie();
    const { id } = await (await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie)).json();

    const res = await put(app, `/vehicles/${id}`, { model: "Golf", colour: "Blue", notes: "Test" }, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.model).toBe("Golf");
    expect(body.colour).toBe("Blue");
    expect(body.notes).toBe("Test");
  });

  it("allows null to clear a field", async () => {
    const cookie = await adminCookie();
    const { id } = await (await post(app, "/vehicles", { registrationNumber: "AA11AAA", model: "Golf" }, cookie)).json();

    const res = await put(app, `/vehicles/${id}`, { model: null }, cookie);
    expect((await res.json()).model).toBeNull();
  });

  it("refreshes updatedAt", async () => {
    const cookie = await adminCookie();
    const created = await (await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie)).json();

    await new Promise((r) => setTimeout(r, 10));
    const updated = await (await put(app, `/vehicles/${created.id}`, { notes: "hi" }, cookie)).json();
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });
});

// ─── Delete vehicle ───────────────────────────────────────────────────────────

describe("DELETE /vehicles/:id", () => {
  it("permanently removes the vehicle", async () => {
    const cookie = await adminCookie();
    const { id } = await (await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie)).json();

    const delRes = await del(app, `/vehicles/${id}`, cookie);
    expect(delRes.status).toBe(200);

    const getRes = await get(app, `/vehicles/${id}`, cookie);
    expect(getRes.status).toBe(404);
  });
});

// ─── Archive / unarchive ──────────────────────────────────────────────────────

describe("POST /vehicles/:id/archive", () => {
  it("archives a vehicle with reason=sold and captures sale details", async () => {
    const cookie = await adminCookie();
    const { id } = await (await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie)).json();

    const res = await post(app, `/vehicles/${id}/archive`, {
      reason: "sold",
      saleDate: "2026-03-01",
      buyerName: "John Smith",
      buyerContact: "07700000000",
    }, cookie);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archivedAt).not.toBeNull();
    expect(body.archiveReason).toBe("sold");
    expect(body.saleDate).toBe("2026-03-01");
    expect(body.buyerName).toBe("John Smith");
    expect(body.buyerContact).toBe("07700000000");
  });

  it("nulls out sale fields when reason=scrapped", async () => {
    const cookie = await adminCookie();
    const { id } = await (await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie)).json();

    const res = await post(app, `/vehicles/${id}/archive`, {
      reason: "scrapped",
      saleDate: "2026-03-01",
      buyerName: "John",
    }, cookie);

    const body = await res.json();
    expect(body.archiveReason).toBe("scrapped");
    expect(body.saleDate).toBeNull();
    expect(body.buyerName).toBeNull();
  });

  it("removes the vehicle from the active list", async () => {
    const cookie = await adminCookie();
    const { id } = await (await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie)).json();
    await post(app, `/vehicles/${id}/archive`, { reason: "other" }, cookie);

    const list = await (await get(app, "/vehicles", cookie)).json();
    expect(list.find((v: { id: number }) => v.id === id)).toBeUndefined();
  });

  it("returns 400 for invalid reason", async () => {
    const cookie = await adminCookie();
    const { id } = await (await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie)).json();
    const res = await post(app, `/vehicles/${id}/archive`, { reason: "stolen" }, cookie);
    expect(res.status).toBe(400);
  });
});

describe("POST /vehicles/:id/unarchive", () => {
  it("restores the vehicle and clears all archive fields", async () => {
    const cookie = await adminCookie();
    const { id } = await (await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie)).json();

    await post(app, `/vehicles/${id}/archive`, {
      reason: "sold",
      buyerName: "John",
      saleDate: "2026-01-01",
    }, cookie);

    const res = await post(app, `/vehicles/${id}/unarchive`, {}, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archivedAt).toBeNull();
    expect(body.archiveReason).toBeNull();
    expect(body.buyerName).toBeNull();
    expect(body.saleDate).toBeNull();
  });

  it("vehicle reappears in the active list after unarchive", async () => {
    const cookie = await adminCookie();
    const { id } = await (await post(app, "/vehicles", { registrationNumber: "AA11AAA" }, cookie)).json();
    await post(app, `/vehicles/${id}/archive`, { reason: "other" }, cookie);
    await post(app, `/vehicles/${id}/unarchive`, {}, cookie);

    const list = await (await get(app, "/vehicles", cookie)).json();
    expect(list.find((v: { id: number }) => v.id === id)).toBeDefined();
  });
});
