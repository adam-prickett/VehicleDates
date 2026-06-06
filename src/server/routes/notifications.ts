import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  notificationChannels,
  notificationPreferences,
  notificationLog,
  type NotificationChannel,
} from "../db/schema.js";
import { getProvider, listProviders } from "../notifications/providers/index.js";
import { dispatchNotificationsForUser } from "../notifications/scheduler.js";
import type { AuthUser } from "../middleware/auth.js";

const leadDaysSchema = z
  .array(z.number().int().min(0).max(3650))
  .max(20)
  .transform((arr) => [...new Set(arr)].sort((a, b) => a - b));

const preferencesSchema = z.object({
  enabled: z.boolean(),
  leadDaysTax: leadDaysSchema,
  leadDaysMot: leadDaysSchema,
  leadDaysInsurance: leadDaysSchema,
  leadDaysService: leadDaysSchema,
  sendHour: z.number().int().min(0).max(23),
  sendMinute: z.number().int().min(0).max(59),
  timezone: z.string().min(1).max(64),
});

const channelCreateSchema = z.object({
  type: z.string().min(1).max(32),
  label: z.string().min(1).max(100),
  config: z.unknown(),
  enabled: z.boolean().optional(),
});

const channelUpdateSchema = z.object({
  type: z.string().min(1).max(32).optional(),
  label: z.string().min(1).max(100).optional(),
  config: z.unknown().optional(),
  enabled: z.boolean().optional(),
});

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function serializeChannel(c: NotificationChannel) {
  let config: unknown = null;
  try {
    config = JSON.parse(c.config);
  } catch {
    config = null;
  }
  return {
    id: c.id,
    type: c.type,
    label: c.label,
    enabled: c.enabled,
    config,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

async function loadOrCreatePreferences(userId: number) {
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  if (existing) return existing;
  const now = new Date().toISOString();
  const [inserted] = await db
    .insert(notificationPreferences)
    .values({ userId, updatedAt: now })
    .returning();
  return inserted;
}

function serializePreferences(p: Awaited<ReturnType<typeof loadOrCreatePreferences>>) {
  function parseArray(s: string): number[] {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
    } catch {
      return [];
    }
  }
  return {
    enabled: p.enabled,
    leadDaysTax: parseArray(p.leadDaysTax),
    leadDaysMot: parseArray(p.leadDaysMot),
    leadDaysInsurance: parseArray(p.leadDaysInsurance),
    leadDaysService: parseArray(p.leadDaysService),
    sendHour: p.sendHour,
    sendMinute: p.sendMinute,
    timezone: p.timezone,
    updatedAt: p.updatedAt,
  };
}

export const notificationsRouter = new Hono()
  .get("/providers", (c) => c.json(listProviders()))

  .get("/preferences", async (c) => {
    const user = c.get("user") as AuthUser;
    const prefs = await loadOrCreatePreferences(user.id);
    return c.json(serializePreferences(prefs));
  })

  .put("/preferences", zValidator("json", preferencesSchema), async (c) => {
    const user = c.get("user") as AuthUser;
    const data = c.req.valid("json");
    if (!isValidTimezone(data.timezone)) {
      return c.json({ error: "Invalid timezone" }, 400);
    }

    const now = new Date().toISOString();
    const values = {
      userId: user.id,
      enabled: data.enabled,
      leadDaysTax: JSON.stringify(data.leadDaysTax),
      leadDaysMot: JSON.stringify(data.leadDaysMot),
      leadDaysInsurance: JSON.stringify(data.leadDaysInsurance),
      leadDaysService: JSON.stringify(data.leadDaysService),
      sendHour: data.sendHour,
      sendMinute: data.sendMinute,
      timezone: data.timezone,
      updatedAt: now,
    };

    const [existing] = await db
      .select({ userId: notificationPreferences.userId })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id))
      .limit(1);

    if (existing) {
      await db
        .update(notificationPreferences)
        .set(values)
        .where(eq(notificationPreferences.userId, user.id));
    } else {
      await db.insert(notificationPreferences).values(values);
    }

    const fresh = await loadOrCreatePreferences(user.id);
    return c.json(serializePreferences(fresh));
  })

  .get("/channels", async (c) => {
    const user = c.get("user") as AuthUser;
    const rows = await db
      .select()
      .from(notificationChannels)
      .where(eq(notificationChannels.userId, user.id))
      .orderBy(notificationChannels.createdAt);
    return c.json(rows.map(serializeChannel));
  })

  .post("/channels", zValidator("json", channelCreateSchema), async (c) => {
    const user = c.get("user") as AuthUser;
    const data = c.req.valid("json");
    const provider = getProvider(data.type);
    if (!provider) {
      return c.json({ error: `Unknown provider type: ${data.type}` }, 400);
    }
    const parsed = provider.configSchema.safeParse(data.config);
    if (!parsed.success) {
      return c.json(
        { error: `Invalid ${data.type} config`, details: parsed.error.flatten() },
        400
      );
    }

    const now = new Date().toISOString();
    const [inserted] = await db
      .insert(notificationChannels)
      .values({
        userId: user.id,
        type: data.type,
        label: data.label,
        config: JSON.stringify(parsed.data),
        enabled: data.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return c.json(serializeChannel(inserted), 201);
  })

  .put("/channels/:id", zValidator("json", channelUpdateSchema), async (c) => {
    const user = c.get("user") as AuthUser;
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const [existing] = await db
      .select()
      .from(notificationChannels)
      .where(and(eq(notificationChannels.id, id), eq(notificationChannels.userId, user.id)))
      .limit(1);
    if (!existing) return c.json({ error: "Not found" }, 404);

    const data = c.req.valid("json");
    const updates: Partial<NotificationChannel> = {
      updatedAt: new Date().toISOString(),
    };
    if (data.label !== undefined) updates.label = data.label;
    if (data.enabled !== undefined) updates.enabled = data.enabled;
    if (data.type !== undefined) updates.type = data.type;

    // If config or type changed, re-validate the (effective) config against
    // the (effective) provider schema.
    if (data.config !== undefined || data.type !== undefined) {
      const type = data.type ?? existing.type;
      const provider = getProvider(type);
      if (!provider) return c.json({ error: `Unknown provider type: ${type}` }, 400);

      const candidate =
        data.config !== undefined
          ? data.config
          : (() => {
              try {
                return JSON.parse(existing.config);
              } catch {
                return null;
              }
            })();

      const parsed = provider.configSchema.safeParse(candidate);
      if (!parsed.success) {
        return c.json(
          { error: `Invalid ${type} config`, details: parsed.error.flatten() },
          400
        );
      }
      updates.config = JSON.stringify(parsed.data);
    }

    const [updated] = await db
      .update(notificationChannels)
      .set(updates)
      .where(eq(notificationChannels.id, id))
      .returning();
    return c.json(serializeChannel(updated));
  })

  .delete("/channels/:id", async (c) => {
    const user = c.get("user") as AuthUser;
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const [deleted] = await db
      .delete(notificationChannels)
      .where(and(eq(notificationChannels.id, id), eq(notificationChannels.userId, user.id)))
      .returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ success: true });
  })

  .post("/channels/:id/test", async (c) => {
    const user = c.get("user") as AuthUser;
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const [channel] = await db
      .select()
      .from(notificationChannels)
      .where(and(eq(notificationChannels.id, id), eq(notificationChannels.userId, user.id)))
      .limit(1);
    if (!channel) return c.json({ error: "Not found" }, 404);

    const provider = getProvider(channel.type);
    if (!provider) {
      return c.json({ error: `Provider ${channel.type} is no longer available` }, 500);
    }

    let cfg: unknown;
    try {
      cfg = JSON.parse(channel.config);
    } catch {
      return c.json({ error: "Stored channel config is corrupt" }, 500);
    }
    const parsed = provider.configSchema.safeParse(cfg);
    if (!parsed.success) {
      return c.json(
        { error: "Stored channel config no longer validates", details: parsed.error.flatten() },
        500
      );
    }

    try {
      await provider.send(parsed.data, {
        title: "Vehicle Dates - Test",
        body: `Test notification from "${channel.label}". If you can read this, your channel is configured correctly.`,
        priority: "default",
        tags: ["car"],
      });
      return c.json({ success: true });
    } catch (err) {
      return c.json({ success: false, error: (err as Error).message }, 502);
    }
  })

  .get("/log", async (c) => {
    const user = c.get("user") as AuthUser;
    const raw = parseInt(c.req.query("limit") ?? "50");
    const limit = Math.min(200, Math.max(1, Number.isFinite(raw) && raw > 0 ? raw : 50));
    const rows = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.userId, user.id))
      .orderBy(desc(notificationLog.sentAt))
      .limit(limit);
    return c.json(rows);
  })

  // Run the per-user notification check now, ignoring the configured
  // send-hour. Useful after configuring channels to verify end-to-end.
  .post("/run-now", async (c) => {
    const user = c.get("user") as AuthUser;
    const summary = await dispatchNotificationsForUser(user.id, new Date());
    return c.json(summary);
  });
