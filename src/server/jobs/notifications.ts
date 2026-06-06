import cron from "node-cron";
import { lt } from "drizzle-orm";
import { db } from "../db/client.js";
import { notificationLog } from "../db/schema.js";
import { runScheduledCheck } from "../notifications/scheduler.js";

const LOG_RETENTION_DAYS = 180;

/**
 * Drop log rows older than LOG_RETENTION_DAYS. Exported for tests / manual
 * invocation; the scheduler arms it on a daily 4am cron.
 */
export async function pruneNotificationLog(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(notificationLog)
    .where(lt(notificationLog.sentAt, cutoff.toISOString()))
    .returning({ id: notificationLog.id });
  return deleted.length;
}

/**
 * Register the hourly notification scheduler. Runs at every :00 in server
 * time. Each user's preferences carry their own timezone so the per-user
 * filter inside runScheduledCheck handles the local-time match.
 */
export function startNotificationScheduler() {
  cron.schedule("0 * * * *", async () => {
    const startedAt = new Date();
    console.log(
      `[Notifications] Hourly check at ${startedAt.toISOString()}…`
    );
    try {
      const summaries = await runScheduledCheck(startedAt);
      const totals = summaries.reduce(
        (a, s) => ({
          sent: a.sent + s.sent,
          failed: a.failed + s.failed,
          skipped: a.skipped + s.skipped,
        }),
        { sent: 0, failed: 0, skipped: 0 }
      );
      console.log(
        `[Notifications] ${summaries.length} user(s) processed — ${totals.sent} sent, ${totals.failed} failed, ${totals.skipped} skipped.`
      );
    } catch (err) {
      console.error("[Notifications] Scheduled run failed:", err);
    }
  });
  console.log("[Notifications] Hourly scheduler armed (0 * * * *).");

  cron.schedule("0 4 * * *", async () => {
    try {
      const removed = await pruneNotificationLog();
      if (removed > 0) {
        console.log(
          `[Notifications] Pruned ${removed} log row(s) older than ${LOG_RETENTION_DAYS} days.`
        );
      }
    } catch (err) {
      console.error("[Notifications] Log pruning failed:", err);
    }
  });
  console.log(`[Notifications] Daily log pruning armed (0 4 * * *, keep ${LOG_RETENTION_DAYS} days).`);
}
