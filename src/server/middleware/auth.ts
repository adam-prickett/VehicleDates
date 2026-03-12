import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken } from "../lib/jwt.js";

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, "auth_token");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = await verifyToken(token);
  if (!payload) return c.json({ error: "Unauthorized" }, 401);

  c.set("user", { id: parseInt(payload.sub), username: payload.username, role: payload.role } satisfies AuthUser);
  await next();
}
