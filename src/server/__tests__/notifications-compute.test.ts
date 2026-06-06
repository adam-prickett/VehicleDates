import { describe, it, expect } from "vitest";
import {
  computeNotificationsToSend,
  parseLeadDays,
  logKey,
  renderNotification,
  type ComputeVehicle,
  type ComputePreferences,
} from "../notifications/compute.js";

function vehicle(overrides: Partial<ComputeVehicle> = {}): ComputeVehicle {
  return {
    id: 1,
    registrationNumber: "AB12CDE",
    make: "Volkswagen",
    model: "Golf",
    taxDueDate: null,
    motExpiryDate: null,
    insuranceExpiryDate: null,
    serviceDate: null,
    manualSorn: false,
    taxStatus: null,
    archivedAt: null,
    ...overrides,
  };
}

function prefs(overrides: Partial<ComputePreferences> = {}): ComputePreferences {
  return {
    enabled: true,
    leadDaysTax: "[30,7,0]",
    leadDaysMot: "[30,7,0]",
    leadDaysInsurance: "[30,7,0]",
    leadDaysService: "[14,0]",
    ...overrides,
  };
}

// 2026-06-06 fixed so every "days" calculation is deterministic.
const NOW = new Date("2026-06-06T09:00:00Z");

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── parseLeadDays ────────────────────────────────────────────────────────────

describe("parseLeadDays", () => {
  it("parses a JSON int array and sorts ascending", () => {
    expect(parseLeadDays("[30,7,0]")).toEqual([0, 7, 30]);
    expect(parseLeadDays("[7,30,0,14]")).toEqual([0, 7, 14, 30]);
  });

  it("dedupes repeated values", () => {
    expect(parseLeadDays("[7,7,0]")).toEqual([0, 7]);
  });

  it("filters non-integer, negative, non-finite values", () => {
    expect(parseLeadDays('[7,"x",1.5,-3,null,30]')).toEqual([7, 30]);
  });

  it("returns [] for malformed JSON or non-array", () => {
    expect(parseLeadDays("not json")).toEqual([]);
    expect(parseLeadDays("{}")).toEqual([]);
    expect(parseLeadDays("null")).toEqual([]);
  });
});

// ─── computeNotificationsToSend ───────────────────────────────────────────────

describe("computeNotificationsToSend", () => {
  it("returns [] when preferences are disabled", () => {
    const v = vehicle({ motExpiryDate: addDays(NOW.toISOString(), 3) });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs({ enabled: false }),
      alreadySent: new Set(),
      now: NOW,
    });
    expect(out).toEqual([]);
  });

  it("returns [] when there are no vehicles", () => {
    const out = computeNotificationsToSend({
      vehicles: [],
      prefs: prefs(),
      alreadySent: new Set(),
      now: NOW,
    });
    expect(out).toEqual([]);
  });

  it("fires the largest applicable threshold (smallest T with days <= T) and only that one", () => {
    const v = vehicle({ motExpiryDate: addDays(NOW.toISOString(), 25) });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs(),
      alreadySent: new Set(),
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      vehicleId: 1,
      eventType: "mot",
      leadDays: 30,
      daysUntilExpiry: 25,
    });
  });

  it("fires the 7-day threshold when days = 5 (and 30 has already been sent)", () => {
    const v = vehicle({ motExpiryDate: addDays(NOW.toISOString(), 5) });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs(),
      alreadySent: new Set([logKey(1, "mot", v.motExpiryDate!, 30)]),
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0].leadDays).toBe(7);
  });

  it("fires the 0-day threshold on the expiry day", () => {
    const v = vehicle({ motExpiryDate: addDays(NOW.toISOString(), 0) });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs(),
      alreadySent: new Set(),
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ leadDays: 0, daysUntilExpiry: 0 });
  });

  it("never re-fires a threshold that's already in alreadySent", () => {
    const v = vehicle({ motExpiryDate: addDays(NOW.toISOString(), 25) });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs(),
      alreadySent: new Set([logKey(1, "mot", v.motExpiryDate!, 30)]),
      now: NOW,
    });
    expect(out).toEqual([]);
  });

  it("fires only the smallest qualifying threshold for a freshly-overdue event (no backfire flood)", () => {
    // Overdue by 90 days; user just configured notifications so nothing in sent set
    const v = vehicle({ motExpiryDate: addDays(NOW.toISOString(), -90) });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs(),
      alreadySent: new Set(),
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0].leadDays).toBe(0);
    expect(out[0].daysUntilExpiry).toBe(-90);
  });

  it("skips a vehicle entirely once it has been archived", () => {
    const v = vehicle({
      motExpiryDate: addDays(NOW.toISOString(), 3),
      archivedAt: "2026-04-01T00:00:00Z",
    });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs(),
      alreadySent: new Set(),
      now: NOW,
    });
    expect(out).toEqual([]);
  });

  it("skips tax notifications when the vehicle is SORN (manual or DVLA status)", () => {
    const sornManual = vehicle({
      id: 1,
      manualSorn: true,
      taxDueDate: addDays(NOW.toISOString(), 5),
      motExpiryDate: addDays(NOW.toISOString(), 5),
    });
    const sornDvla = vehicle({
      id: 2,
      taxStatus: "SORN",
      taxDueDate: addDays(NOW.toISOString(), 5),
    });
    const out = computeNotificationsToSend({
      vehicles: [sornManual, sornDvla],
      prefs: prefs(),
      alreadySent: new Set(),
      now: NOW,
    });
    expect(out.find((p) => p.eventType === "tax")).toBeUndefined();
    // Non-tax events on the manual SORN vehicle still fire
    expect(out.find((p) => p.eventType === "mot" && p.vehicleId === 1)).toBeDefined();
  });

  it("handles all four event types in one vehicle independently", () => {
    const v = vehicle({
      taxDueDate: addDays(NOW.toISOString(), 5),
      motExpiryDate: addDays(NOW.toISOString(), 5),
      insuranceExpiryDate: addDays(NOW.toISOString(), 5),
      serviceDate: addDays(NOW.toISOString(), 5),
    });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs(),
      alreadySent: new Set(),
      now: NOW,
    });
    const events = out.map((p) => p.eventType).sort();
    expect(events).toEqual(["insurance", "mot", "service", "tax"]);
  });

  it("skips event types that have no lead-day thresholds configured", () => {
    const v = vehicle({ motExpiryDate: addDays(NOW.toISOString(), 3) });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs({ leadDaysMot: "[]" }),
      alreadySent: new Set(),
      now: NOW,
    });
    expect(out).toEqual([]);
  });

  it("ignores invalid date strings without throwing", () => {
    const v = vehicle({ motExpiryDate: "not-a-date" });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs(),
      alreadySent: new Set(),
      now: NOW,
    });
    expect(out).toEqual([]);
  });

  it("uses calendar-day diff so timezone offsets don't shift the threshold by one", () => {
    // Event date is the same calendar day in any reasonable timezone
    const v = vehicle({ motExpiryDate: NOW.toISOString().slice(0, 10) });
    const out = computeNotificationsToSend({
      vehicles: [v],
      prefs: prefs(),
      alreadySent: new Set(),
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ leadDays: 0, daysUntilExpiry: 0 });
  });

  it("steps through the lifetime of a single MOT correctly", () => {
    const eventDate = addDays(NOW.toISOString(), 30);
    const v = vehicle({ motExpiryDate: eventDate });
    let sent = new Set<string>();

    // Day -30: fire 30-day
    let out = computeNotificationsToSend({ vehicles: [v], prefs: prefs(), alreadySent: sent, now: NOW });
    expect(out.map((p) => p.leadDays)).toEqual([30]);
    sent = new Set([...sent, logKey(1, "mot", eventDate, 30)]);

    // Day -29: nothing to fire
    const day29 = new Date(NOW);
    day29.setUTCDate(day29.getUTCDate() + 1);
    out = computeNotificationsToSend({ vehicles: [v], prefs: prefs(), alreadySent: sent, now: day29 });
    expect(out).toEqual([]);

    // Day -7: fire 7-day
    const day7 = new Date(NOW);
    day7.setUTCDate(day7.getUTCDate() + 23);
    out = computeNotificationsToSend({ vehicles: [v], prefs: prefs(), alreadySent: sent, now: day7 });
    expect(out.map((p) => p.leadDays)).toEqual([7]);
    sent = new Set([...sent, logKey(1, "mot", eventDate, 7)]);

    // Day 0: fire 0-day
    const day0 = new Date(NOW);
    day0.setUTCDate(day0.getUTCDate() + 30);
    out = computeNotificationsToSend({ vehicles: [v], prefs: prefs(), alreadySent: sent, now: day0 });
    expect(out.map((p) => p.leadDays)).toEqual([0]);
    sent = new Set([...sent, logKey(1, "mot", eventDate, 0)]);

    // Day +5: nothing further
    const dayP5 = new Date(NOW);
    dayP5.setUTCDate(dayP5.getUTCDate() + 35);
    out = computeNotificationsToSend({ vehicles: [v], prefs: prefs(), alreadySent: sent, now: dayP5 });
    expect(out).toEqual([]);
  });

  it("invalidates dedupe when the underlying date is renewed", () => {
    const oldDate = addDays(NOW.toISOString(), 3);
    const renewedDate = addDays(NOW.toISOString(), 25); // still inside the 30-day threshold
    const v = vehicle({ motExpiryDate: oldDate });

    // Already sent the 7-day for the *old* date
    const sent = new Set([logKey(1, "mot", oldDate, 7)]);

    // First confirm: with the old date, that send blocks re-fire
    let out = computeNotificationsToSend({ vehicles: [v], prefs: prefs(), alreadySent: sent, now: NOW });
    expect(out).toEqual([]);

    // After renewal the dedupe key no longer matches — fresh 30-day cycle begins
    const renewed = { ...v, motExpiryDate: renewedDate };
    out = computeNotificationsToSend({ vehicles: [renewed], prefs: prefs(), alreadySent: sent, now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ eventType: "mot", eventDate: renewedDate, leadDays: 30 });
  });
});

// ─── renderNotification ───────────────────────────────────────────────────────

describe("renderNotification", () => {
  function plan(over: Partial<Parameters<typeof renderNotification>[0]> = {}) {
    return renderNotification({
      vehicleId: 1,
      registrationNumber: "AB12CDE",
      displayName: "Volkswagen Golf",
      eventType: "mot",
      eventDate: "2026-07-01",
      leadDays: 7,
      daysUntilExpiry: 7,
      ...over,
    });
  }

  it("formats positive days remaining", () => {
    expect(plan({ daysUntilExpiry: 7 }).body).toContain("7 days remaining");
    expect(plan({ daysUntilExpiry: 1 }).body).toContain("1 day remaining");
  });

  it("formats today specifically", () => {
    expect(plan({ daysUntilExpiry: 0 }).body).toContain("expires today");
  });

  it("formats overdue", () => {
    expect(plan({ daysUntilExpiry: -3 }).body).toContain("3 days overdue");
    expect(plan({ daysUntilExpiry: -1 }).body).toContain("1 day overdue");
  });

  it("uses event-type label in the title", () => {
    expect(plan({ eventType: "tax" }).title).toContain("Road Tax");
    expect(plan({ eventType: "service" }).title).toContain("Service");
    expect(plan({ eventType: "insurance" }).title).toContain("Insurance");
    expect(plan({ eventType: "mot" }).title).toContain("MOT");
  });
});
