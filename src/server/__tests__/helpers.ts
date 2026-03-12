import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import * as schema from "../db/schema.js";
import { authRouter } from "../routes/auth.js";
import { vehiclesRouter } from "../routes/vehicles.js";
import { usersRouter } from "../routes/users.js";
import { settingsRouter } from "../routes/settings.js";
import { requireAuth } from "../middleware/auth.js";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

export type TestDb = ReturnType<typeof createTestDb>;

/** Build a Hono app wiring up all routers — uses whatever db is mocked at call time. */
export function makeApp() {
  const app = new Hono();
  app.route("/auth", authRouter);
  app.use("/vehicles/*", requireAuth);
  app.use("/users/*", requireAuth);
  app.use("/settings/*", requireAuth);
  app.route("/vehicles", vehiclesRouter);
  app.route("/users", usersRouter);
  app.route("/settings", settingsRouter);
  return app;
}

/** Extract the auth_token cookie value from a Set-Cookie response header. */
export function extractCookie(res: Response): string {
  const header = res.headers.get("set-cookie") ?? "";
  const match = header.match(/auth_token=([^;]+)/);
  return match ? `auth_token=${match[1]}` : "";
}

/** POST JSON to a Hono app.request path. */
export function post(app: Hono, path: string, body: unknown, cookie = "") {
  return app.request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** GET from a Hono app.request path. */
export function get(app: Hono, path: string, cookie = "") {
  return app.request(path, {
    headers: cookie ? { cookie } : {},
  });
}

/** DELETE from a Hono app.request path. */
export function del(app: Hono, path: string, cookie = "") {
  return app.request(path, {
    method: "DELETE",
    headers: cookie ? { cookie } : {},
  });
}

/** PUT JSON to a Hono app.request path. */
export function put(app: Hono, path: string, body: unknown, cookie = "") {
  return app.request(path, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
