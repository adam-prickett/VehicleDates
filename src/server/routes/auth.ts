import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { signToken, verifyToken } from "../lib/jwt.js";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 400, // 400 days (browser/spec maximum)
  secure: process.env.NODE_ENV === "production",
};

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const setupSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
});

export const authRouter = new Hono()

  .get("/setup", async (c) => {
    const [existing] = await db.select({ id: users.id }).from(users).limit(1);
    return c.json({ needed: !existing });
  })

  .post("/setup", zValidator("json", setupSchema), async (c) => {
    const [existing] = await db.select({ id: users.id }).from(users).limit(1);
    if (existing) return c.json({ error: "Setup already complete" }, 409);

    const { username, password } = c.req.valid("json");
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db
      .insert(users)
      .values({ username, passwordHash, role: "admin", createdAt: now, updatedAt: now })
      .returning({ id: users.id, username: users.username, role: users.role, tokenVersion: users.tokenVersion });

    const token = await signToken({
      sub: String(user.id),
      username: user.username,
      role: user.role,
      ver: user.tokenVersion,
    });
    setCookie(c, "auth_token", token, COOKIE_OPTS);
    return c.json({ id: user.id, username: user.username, role: user.role }, 201);
  })

  .post("/login", zValidator("json", loginSchema), async (c) => {
    const { username, password } = c.req.valid("json");

    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user) return c.json({ error: "Invalid username or password" }, 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return c.json({ error: "Invalid username or password" }, 401);

    const token = await signToken({
      sub: String(user.id),
      username: user.username,
      role: user.role,
      ver: user.tokenVersion,
    });
    setCookie(c, "auth_token", token, COOKIE_OPTS);
    return c.json({ id: user.id, username: user.username, role: user.role });
  })

  .post("/logout", async (c) => {
    const token = getCookie(c, "auth_token");
    if (token) {
      const payload = await verifyToken(token);
      const id = payload ? Number(payload.sub) : NaN;
      if (Number.isInteger(id) && id > 0) {
        const now = new Date().toISOString();
        await db
          .update(users)
          .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: now })
          .where(eq(users.id, id));
      }
    }
    deleteCookie(c, "auth_token", { path: "/" });
    return c.json({ success: true });
  })

  .get("/me", async (c) => {
    const token = getCookie(c, "auth_token");
    if (!token) return c.json({ error: "Unauthorized" }, 401);

    const payload = await verifyToken(token);
    if (!payload) return c.json({ error: "Unauthorized" }, 401);

    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        tokenVersion: users.tokenVersion,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if ((payload.ver ?? 0) !== user.tokenVersion) {
      return c.json({ error: "Session expired" }, 401);
    }
    return c.json({ id: user.id, username: user.username, role: user.role });
  });
