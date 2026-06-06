/**
 * Return the local hour (0–23) of the given instant in the given IANA timezone.
 * Falls back to UTC when the timezone string is invalid so a bad config never
 * stops the scheduler entirely.
 */
export function localHour(timezone: string, now: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const raw = parts.find((p) => p.type === "hour")?.value;
    if (raw == null) return now.getUTCHours();
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return now.getUTCHours();
    // en-GB occasionally reports "24" for midnight; normalise.
    return n === 24 ? 0 : n;
  } catch {
    return now.getUTCHours();
  }
}
