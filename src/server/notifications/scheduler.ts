import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  notificationChannels,
  notificationLog,
  notificationPreferences,
  vehicles,
} from "../db/schema.js";
import { getProvider } from "./providers/index.js";
import {
  computeNotificationsToSend,
  logKey,
  renderNotification,
  type EventType,
} from "./compute.js";
import { localHour } from "./timezone.js";

export interface DispatchSummary {
  userId: number;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{
    vehicleId: number;
    eventType: EventType;
    channelId: number;
    message: string;
  }>;
}

/**
 * How many consecutive failed attempts for the same dedupe key before we
 * stop retrying. Reset implicitly when the underlying eventDate changes
 * (different key → no failure history).
 */
export const MAX_FAILED_ATTEMPTS = 3;

function emptySummary(userId: number): DispatchSummary {
  return { userId, attempted: 0, sent: 0, failed: 0, skipped: 0, errors: [] };
}

/**
 * Run the notification check for a single user, sending via every enabled
 * channel they have configured. Each (vehicle, event, eventDate, leadDays,
 * channelId) tuple is at most sent once because of dedupe against
 * notification_log. Failures persist as `status='failed'` rows and are
 * retried on subsequent runs.
 */
export async function dispatchNotificationsForUser(
  userId: number,
  now: Date
): Promise<DispatchSummary> {
  const summary = emptySummary(userId);

  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  if (!prefs || !prefs.enabled) return summary;

  const channels = await db
    .select()
    .from(notificationChannels)
    .where(
      and(
        eq(notificationChannels.userId, userId),
        eq(notificationChannels.enabled, true)
      )
    );
  if (channels.length === 0) return summary;

  const vehiclesRows = await db.select().from(vehicles);

  // Pull this user's log rows once; we filter per-channel below. Successful
  // sends dedupe immediately; failed sends dedupe only once the per-key count
  // hits MAX_FAILED_ATTEMPTS (so transient errors retry on the next run, but
  // a permanently broken channel doesn't fill the log forever).
  const logRows = await db
    .select({
      vehicleId: notificationLog.vehicleId,
      eventType: notificationLog.eventType,
      eventDate: notificationLog.eventDate,
      leadDays: notificationLog.leadDays,
      channelId: notificationLog.channelId,
      status: notificationLog.status,
    })
    .from(notificationLog)
    .where(eq(notificationLog.userId, userId));

  for (const channel of channels) {
    const sentForChannel = new Set<string>();
    const failedCounts = new Map<string, number>();
    for (const r of logRows) {
      if (r.channelId !== channel.id) continue;
      const key = logKey(
        r.vehicleId,
        r.eventType as EventType,
        r.eventDate,
        r.leadDays
      );
      if (r.status === "sent") {
        sentForChannel.add(key);
      } else if (r.status === "failed") {
        failedCounts.set(key, (failedCounts.get(key) ?? 0) + 1);
      }
    }
    for (const [key, n] of failedCounts) {
      if (n >= MAX_FAILED_ATTEMPTS) sentForChannel.add(key);
    }

    const planned = computeNotificationsToSend({
      vehicles: vehiclesRows,
      prefs: {
        enabled: prefs.enabled,
        leadDaysTax: prefs.leadDaysTax,
        leadDaysMot: prefs.leadDaysMot,
        leadDaysInsurance: prefs.leadDaysInsurance,
        leadDaysService: prefs.leadDaysService,
      },
      alreadySent: sentForChannel,
      now,
    });

    if (planned.length === 0) continue;

    const provider = getProvider(channel.type);
    if (!provider) {
      summary.skipped += planned.length;
      continue;
    }

    let cfg: unknown;
    try {
      cfg = JSON.parse(channel.config);
    } catch {
      summary.skipped += planned.length;
      continue;
    }
    const parsed = provider.configSchema.safeParse(cfg);
    if (!parsed.success) {
      summary.skipped += planned.length;
      continue;
    }

    const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");

    for (const p of planned) {
      summary.attempted++;
      const { title, body } = renderNotification(p);
      const priority: "high" | "default" = p.daysUntilExpiry <= 0 ? "high" : "default";
      const url = baseUrl ? `${baseUrl}/vehicles/${p.vehicleId}` : undefined;

      const nowIso = new Date().toISOString();
      try {
        await provider.send(parsed.data, {
          title,
          body,
          priority,
          tags: [p.eventType],
          url,
        });
        await db.insert(notificationLog).values({
          userId,
          vehicleId: p.vehicleId,
          eventType: p.eventType,
          eventDate: p.eventDate,
          leadDays: p.leadDays,
          channelId: channel.id,
          status: "sent",
          sentAt: nowIso,
        });
        summary.sent++;
      } catch (err) {
        const message = (err instanceof Error ? err.message : String(err)) || "unknown";
        await db.insert(notificationLog).values({
          userId,
          vehicleId: p.vehicleId,
          eventType: p.eventType,
          eventDate: p.eventDate,
          leadDays: p.leadDays,
          channelId: channel.id,
          status: "failed",
          error: message.slice(0, 500),
          sentAt: nowIso,
        });
        summary.failed++;
        summary.errors.push({
          vehicleId: p.vehicleId,
          eventType: p.eventType,
          channelId: channel.id,
          message,
        });
      }
    }
  }

  return summary;
}

/**
 * Hourly scheduler entry point. For every user whose preferences are enabled
 * AND whose configured send_hour matches the current local hour in their
 * timezone, dispatch notifications.
 */
export async function runScheduledCheck(now: Date): Promise<DispatchSummary[]> {
  const enabledPrefs = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.enabled, true));

  const summaries: DispatchSummary[] = [];
  for (const prefs of enabledPrefs) {
    if (localHour(prefs.timezone, now) !== prefs.sendHour) continue;
    const summary = await dispatchNotificationsForUser(prefs.userId, now);
    summaries.push(summary);
  }
  return summaries;
}
