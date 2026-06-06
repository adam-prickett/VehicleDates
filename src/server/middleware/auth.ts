import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { verifyToken } from "../lib/jwt.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, "auth_token");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = await verifyToken(token);
  if (!payload) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(payload.sub);
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const [user] = await db
    .select({ id: users.id, username: users.username, role: users.role, tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if ((payload.ver ?? 0) !== user.tokenVersion) {
    return c.json({ error: "Session expired" }, 401);
  }

  c.set("user", { id: user.id, username: user.username, role: user.role } satisfies AuthUser);
  await next();
}

export async function requireAdmin(c: Context, next: Next) {
  const user = c.get("user") as AuthUser | undefined;
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.role !== "admin") return c.json({ error: "Forbidden" }, 403);
  await next();
}
