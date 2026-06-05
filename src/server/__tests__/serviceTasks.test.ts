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
  sqlite.pragma("foreign_keys = ON");
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

async function clearDb() {
  await db.delete(schema.serviceTasks);
  await db.delete(schema.vehicles);
  await db.delete(schema.users);
}

beforeEach(clearDb);

async function adminCookie() {
  const res = await post(app, "/auth/setup", { username: "admin", password: "password123" });
  return extractCookie(res);
}

async function createVehicle(cookie: string, reg = "AA11AAA") {
  const res = await post(app, "/vehicles", { registrationNumber: reg }, cookie);
  return (await res.json()) as { id: number };
}

// ─── Create service task ──────────────────────────────────────────────────────

describe("POST /vehicles/:id/service-tasks", () => {
  it("creates a service task and returns 201", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const res = await post(
      app,
      `/vehicles/${id}/service-tasks`,
      {
        type: "Oil Change",
        date: "2026-05-01",
        mileage: 45000,
        cost: 8500,
        notes: "Castrol Edge 5W-30",
      },
      cookie
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTypeOf("number");
    expect(body.vehicleId).toBe(id);
    expect(body.type).toBe("Oil Change");
    expect(body.date).toBe("2026-05-01");
    expect(body.mileage).toBe(45000);
    expect(body.cost).toBe(8500);
    expect(body.notes).toBe("Castrol Edge 5W-30");
  });

  it("accepts optional fields as null/absent", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const res = await post(
      app,
      `/vehicles/${id}/service-tasks`,
      { type: "Full Service", date: "2026-04-01" },
      cookie
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.mileage).toBeNull();
    expect(body.cost).toBeNull();
    expect(body.notes).toBeNull();
  });

  it("returns 400 when type is missing", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const res = await post(app, `/vehicles/${id}/service-tasks`, { date: "2026-04-01" }, cookie);
    expect(res.status).toBe(400);
  });

  it("returns 400 when date is missing", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const res = await post(app, `/vehicles/${id}/service-tasks`, { type: "Brake Pads" }, cookie);
    expect(res.status).toBe(400);
  });

  it("returns 400 when mileage is negative", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const res = await post(
      app,
      `/vehicles/${id}/service-tasks`,
      { type: "Tyres", date: "2026-04-01", mileage: -1 },
      cookie
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when vehicle does not exist", async () => {
    const cookie = await adminCookie();
    const res = await post(
      app,
      `/vehicles/99999/service-tasks`,
      { type: "Oil Change", date: "2026-04-01" },
      cookie
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const res = await post(app, `/vehicles/${id}/service-tasks`, {
      type: "Oil Change",
      date: "2026-04-01",
    });
    expect(res.status).toBe(401);
  });
});

// ─── List service tasks ───────────────────────────────────────────────────────

describe("GET /vehicles/:id/service-tasks", () => {
  it("returns an empty array when no tasks exist", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const res = await get(app, `/vehicles/${id}/service-tasks`, cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns only tasks for the requested vehicle", async () => {
    const cookie = await adminCookie();
    const a = await createVehicle(cookie, "AA11AAA");
    const b = await createVehicle(cookie, "BB22BBB");

    await post(app, `/vehicles/${a.id}/service-tasks`, { type: "Oil Change", date: "2026-04-01" }, cookie);
    await post(app, `/vehicles/${a.id}/service-tasks`, { type: "Tyres", date: "2026-04-02" }, cookie);
    await post(app, `/vehicles/${b.id}/service-tasks`, { type: "Brake Pads", date: "2026-04-03" }, cookie);

    const aTasks = await (await get(app, `/vehicles/${a.id}/service-tasks`, cookie)).json();
    const bTasks = await (await get(app, `/vehicles/${b.id}/service-tasks`, cookie)).json();

    expect(aTasks).toHaveLength(2);
    expect(bTasks).toHaveLength(1);
    expect(aTasks.every((t: { vehicleId: number }) => t.vehicleId === a.id)).toBe(true);
    expect(bTasks[0].type).toBe("Brake Pads");
  });

  it("returns 401 without auth", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const res = await get(app, `/vehicles/${id}/service-tasks`);
    expect(res.status).toBe(401);
  });
});

// ─── Update service task ──────────────────────────────────────────────────────

describe("PUT /vehicles/:id/service-tasks/:taskId", () => {
  it("updates editable fields", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const created = await (
      await post(app, `/vehicles/${id}/service-tasks`, { type: "Oil Change", date: "2026-04-01" }, cookie)
    ).json();

    const res = await put(
      app,
      `/vehicles/${id}/service-tasks/${created.id}`,
      { type: "Full Service", mileage: 50000, cost: 25000 },
      cookie
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("Full Service");
    expect(body.mileage).toBe(50000);
    expect(body.cost).toBe(25000);
    expect(body.date).toBe("2026-04-01");
  });

  it("refreshes updatedAt", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const created = await (
      await post(app, `/vehicles/${id}/service-tasks`, { type: "Oil Change", date: "2026-04-01" }, cookie)
    ).json();

    await new Promise((r) => setTimeout(r, 10));
    const updated = await (
      await put(app, `/vehicles/${id}/service-tasks/${created.id}`, { notes: "later" }, cookie)
    ).json();
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it("returns 404 when task does not belong to vehicle", async () => {
    const cookie = await adminCookie();
    const a = await createVehicle(cookie, "AA11AAA");
    const b = await createVehicle(cookie, "BB22BBB");
    const task = await (
      await post(app, `/vehicles/${a.id}/service-tasks`, { type: "Tyres", date: "2026-04-01" }, cookie)
    ).json();

    const res = await put(
      app,
      `/vehicles/${b.id}/service-tasks/${task.id}`,
      { type: "Brake Pads" },
      cookie
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown task id", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const res = await put(app, `/vehicles/${id}/service-tasks/99999`, { type: "Tyres" }, cookie);
    expect(res.status).toBe(404);
  });
});

// ─── Delete service task ──────────────────────────────────────────────────────

describe("DELETE /vehicles/:id/service-tasks/:taskId", () => {
  it("removes a task", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const created = await (
      await post(app, `/vehicles/${id}/service-tasks`, { type: "Oil Change", date: "2026-04-01" }, cookie)
    ).json();

    const res = await del(app, `/vehicles/${id}/service-tasks/${created.id}`, cookie);
    expect(res.status).toBe(200);

    const list = await (await get(app, `/vehicles/${id}/service-tasks`, cookie)).json();
    expect(list).toHaveLength(0);
  });

  it("returns 404 when task does not belong to vehicle", async () => {
    const cookie = await adminCookie();
    const a = await createVehicle(cookie, "AA11AAA");
    const b = await createVehicle(cookie, "BB22BBB");
    const task = await (
      await post(app, `/vehicles/${a.id}/service-tasks`, { type: "Tyres", date: "2026-04-01" }, cookie)
    ).json();

    const res = await del(app, `/vehicles/${b.id}/service-tasks/${task.id}`, cookie);
    expect(res.status).toBe(404);

    const aTasks = await (await get(app, `/vehicles/${a.id}/service-tasks`, cookie)).json();
    expect(aTasks).toHaveLength(1);
  });

  it("returns 404 for unknown task id", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const res = await del(app, `/vehicles/${id}/service-tasks/99999`, cookie);
    expect(res.status).toBe(404);
  });
});

// ─── Cascade delete ───────────────────────────────────────────────────────────

describe("cascade delete", () => {
  it("removes a vehicle's service tasks when the vehicle is deleted", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    await post(app, `/vehicles/${id}/service-tasks`, { type: "Oil Change", date: "2026-04-01" }, cookie);
    await post(app, `/vehicles/${id}/service-tasks`, { type: "Tyres", date: "2026-04-02" }, cookie);

    await del(app, `/vehicles/${id}`, cookie);

    const remaining = await db.select().from(schema.serviceTasks);
    expect(remaining).toHaveLength(0);
  });
});
