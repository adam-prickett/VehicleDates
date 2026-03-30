import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
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
      .returning({ id: users.id, username: users.username, role: users.role });

    const token = await signToken({ sub: String(user.id), username: user.username, role: user.role });
    setCookie(c, "auth_token", token, COOKIE_OPTS);
    return c.json(user, 201);
  })

  .post("/login", zValidator("json", loginSchema), async (c) => {
    const { username, password } = c.req.valid("json");

    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user) return c.json({ error: "Invalid username or password" }, 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return c.json({ error: "Invalid username or password" }, 401);

    const token = await signToken({ sub: String(user.id), username: user.username, role: user.role });
    setCookie(c, "auth_token", token, COOKIE_OPTS);
    return c.json({ id: user.id, username: user.username, role: user.role });
  })

  .post("/logout", (c) => {
    deleteCookie(c, "auth_token", { path: "/" });
    return c.json({ success: true });
  })

  .get("/me", async (c) => {
    const token = getCookie(c, "auth_token");
    if (!token) return c.json({ error: "Unauthorized" }, 401);

    const payload = await verifyToken(token);
    if (!payload) return c.json({ error: "Unauthorized" }, 401);

    const [user] = await db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, parseInt(payload.sub)))
      .limit(1);

    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return c.json(user);
  });
