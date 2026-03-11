import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { vehicles } from "../db/schema.js";
import { getSetting, setSetting, deleteSetting } from "../db/settingsHelper.js";
import { getEffectiveApiKey } from "../services/dvla.js";

export const settingsRouter = new Hono()

  // --- DVLA API Key ---

  .get("/dvla-key", async (c) => {
    const key = await getEffectiveApiKey();
    const fromDb = await getSetting("dvla_api_key");
    if (!key) return c.json({ isSet: false, hint: null, source: null });
    const hint = key.length > 4 ? `${"●".repeat(key.length - 4)}${key.slice(-4)}` : "●●●●";
    return c.json({
      isSet: true,
      hint,
      source: fromDb ? "database" : "environment",
    });
  })

  .post(
    "/dvla-key",
    zValidator("json", z.object({ apiKey: z.string().min(1) })),
    async (c) => {
      const { apiKey } = c.req.valid("json");
      await setSetting("dvla_api_key", apiKey.trim());
      return c.json({ success: true });
    }
  )

  .delete("/dvla-key", async (c) => {
    await deleteSetting("dvla_api_key");
    return c.json({ success: true });
  })

  // --- Export ---

  .get("/export", async (c) => {
    const all = await db.select().from(vehicles);
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      vehicles: all,
    };
    c.header("Content-Type", "application/json");
    c.header(
      "Content-Disposition",
      `attachment; filename="vehicle-dates-export-${new Date().toISOString().slice(0, 10)}.json"`
    );
    return c.json(payload);
  })

  // --- Import ---

  .post(
    "/import",
    zValidator(
      "json",
      z.object({
        version: z.number(),
        vehicles: z.array(
          z.object({
            registrationNumber: z.string(),
            v5DocumentNumber: z.string().nullable().optional(),
            model: z.string().nullable().optional(),
            notes: z.string().nullable().optional(),
            make: z.string().nullable().optional(),
            colour: z.string().nullable().optional(),
            yearOfManufacture: z.number().int().nullable().optional(),
            fuelType: z.string().nullable().optional(),
            engineCapacity: z.number().int().nullable().optional(),
            co2Emissions: z.number().int().nullable().optional(),
            dateOfLastV5CIssued: z.string().nullable().optional(),
            taxStatus: z.string().nullable().optional(),
            taxDueDate: z.string().nullable().optional(),
            motStatus: z.string().nullable().optional(),
            motExpiryDate: z.string().nullable().optional(),
            insuranceExpiryDate: z.string().nullable().optional(),
            insuranceProvider: z.string().nullable().optional(),
            serviceDate: z.string().nullable().optional(),
            serviceIntervalMonths: z.number().int().nullable().optional(),
            manualSorn: z.boolean().nullable().optional(),
            dvlaLastRefreshed: z.string().nullable().optional(),
          })
        ),
      })
    ),
    async (c) => {
      const { vehicles: incoming } = c.req.valid("json");
      const now = new Date().toISOString();
      let imported = 0;
      let updated = 0;

      for (const v of incoming) {
        const reg = v.registrationNumber.replace(/\s+/g, "").toUpperCase();
        const existing = await db
          .select()
          .from(vehicles)
          .where(eq(vehicles.registrationNumber, reg))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(vehicles)
            .set({ ...v, registrationNumber: reg, updatedAt: now })
            .where(
              (await import("drizzle-orm")).eq(vehicles.registrationNumber, reg)
            );
          updated++;
        } else {
          await db.insert(vehicles).values({
            ...v,
            registrationNumber: reg,
            createdAt: now,
            updatedAt: now,
          });
          imported++;
        }
      }

      return c.json({ imported, updated, total: imported + updated });
    }
  );
