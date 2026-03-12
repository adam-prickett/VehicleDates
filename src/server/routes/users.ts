import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import type { AuthUser } from "../middleware/auth.js";

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  role: z.enum(["admin", "user"]).default("user"),
});

const changePasswordSchema = z.object({
  password: z.string().min(8),
});

const USER_COLS = {
  id: users.id,
  username: users.username,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export const usersRouter = new Hono()

  .get("/", async (c) => {
    const currentUser = c.get("user") as AuthUser;
    if (currentUser.role !== "admin") return c.json({ error: "Forbidden" }, 403);

    const all = await db.select(USER_COLS).from(users).orderBy(users.createdAt);
    return c.json(all);
  })

  .post("/", zValidator("json", createUserSchema), async (c) => {
    const currentUser = c.get("user") as AuthUser;
    if (currentUser.role !== "admin") return c.json({ error: "Forbidden" }, 403);

    const { username, password, role } = c.req.valid("json");

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing) return c.json({ error: "Username already exists" }, 409);

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db
      .insert(users)
      .values({ username, passwordHash, role, createdAt: now, updatedAt: now })
      .returning(USER_COLS);

    return c.json(user, 201);
  })

  .put("/:id/password", zValidator("json", changePasswordSchema), async (c) => {
    const currentUser = c.get("user") as AuthUser;
    const targetId = parseInt(c.req.param("id"));
    if (isNaN(targetId)) return c.json({ error: "Invalid ID" }, 400);

    if (currentUser.role !== "admin" && currentUser.id !== targetId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const { password } = c.req.valid("json");
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, 12);

    const [updated] = await db
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, targetId))
      .returning(USER_COLS);

    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const currentUser = c.get("user") as AuthUser;
    if (currentUser.role !== "admin") return c.json({ error: "Forbidden" }, 403);

    const targetId = parseInt(c.req.param("id"));
    if (isNaN(targetId)) return c.json({ error: "Invalid ID" }, 400);

    if (currentUser.id === targetId) {
      return c.json({ error: "Cannot delete your own account" }, 400);
    }

    const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return c.json({ error: "Not found" }, 404);

    if (target.role === "admin") {
      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      if (admins.length <= 1) return c.json({ error: "Cannot delete the last admin account" }, 400);
    }

    await db.delete(users).where(eq(users.id, targetId));
    return c.json({ success: true });
  });
