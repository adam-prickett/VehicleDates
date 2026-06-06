import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import fs from "fs";
import { db } from "../db/client.js";
import { vehicles, serviceTasks } from "../db/schema.js";
import { fetchDvlaVehicle, DvlaApiError } from "../services/dvla.js";
import { refreshAllVehicles } from "../jobs/dvlaRefresh.js";
import {
  saveInsuranceCertificate,
  resolveInsuranceCertificatePath,
  deleteInsuranceCertificate,
  UploadsError,
} from "../lib/uploads.js";

const UK_REG_PATTERN = /^[A-Z]{2}[0-9]{2}\s?[A-Z]{3}$|^[A-Z][0-9]{1,3}\s?[A-Z]{3}$|^[A-Z]{3}\s?[0-9]{1,3}[A-Z]$|^[A-Z]{1,2}[0-9]{1,4}$|^[0-9]{1,4}[A-Z]{1,2}$|^[A-Z]{1,3}[0-9]{1,3}$|^[0-9]{3}[A-Z]{1,3}$/i;

const addVehicleSchema = z.object({
  registrationNumber: z
    .string()
    .min(2)
    .max(10)
    .transform((v) => v.replace(/\s+/g, "").toUpperCase()),
  v5DocumentNumber: z.string().optional(),
  model: z.string().optional(),
  notes: z.string().optional(),
});

const archiveVehicleSchema = z.object({
  reason: z.enum(["sold", "scrapped", "other"]),
  saleDate: z.string().optional().nullable(),
  buyerName: z.string().optional().nullable(),
  buyerContact: z.string().optional().nullable(),
});

const serviceTaskSchema = z.object({
  type: z.string().min(1).max(100),
  date: z.string().min(1),
  mileage: z.number().int().nonnegative().optional().nullable(),
  cost: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateServiceTaskSchema = serviceTaskSchema.partial();

const updateVehicleSchema = z.object({
  v5DocumentNumber: z.string().optional().nullable(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  colour: z.string().optional().nullable(),
  insuranceExpiryDate: z.string().optional().nullable(),
  insuranceProvider: z.string().optional().nullable(),
  insurancePolicyNumber: z.string().max(100).optional().nullable(),
  insurancePremium: z.number().int().nonnegative().optional().nullable(),
  serviceDate: z.string().optional().nullable(),
  serviceIntervalMonths: z.number().int().optional().nullable(),
  // Manual overrides for DVLA-sourced date fields
  taxDueDate: z.string().optional().nullable(),
  motExpiryDate: z.string().optional().nullable(),
  // SORN status
  manualSorn: z.boolean().optional(),
});

async function refreshVehicleFromDvla(vehicleId: number, reg: string) {
  try {
    const dvlaData = await fetchDvlaVehicle(reg);
    const now = new Date().toISOString();

    if (dvlaData) {
      await db
        .update(vehicles)
        .set({
          make: dvlaData.make ?? null,
          colour: dvlaData.colour ?? null,
          yearOfManufacture: dvlaData.yearOfManufacture ?? null,
          fuelType: dvlaData.fuelType ?? null,
          engineCapacity: dvlaData.engineCapacity ?? null,
          co2Emissions: dvlaData.co2Emissions ?? null,
          dateOfLastV5CIssued: dvlaData.dateOfLastV5CIssued ?? null,
          taxStatus: dvlaData.taxStatus ?? null,
          taxDueDate: dvlaData.taxDueDate ?? null,
          motStatus: dvlaData.motStatus ?? null,
          motExpiryDate: dvlaData.motExpiryDate ?? null,
          dvlaLastRefreshed: now,
          updatedAt: now,
        })
        .where(eq(vehicles.id, vehicleId));
      return { success: true, found: true };
    } else {
      await db
        .update(vehicles)
        .set({ dvlaLastRefreshed: now, updatedAt: now })
        .where(eq(vehicles.id, vehicleId));
      return { success: true, found: false };
    }
  } catch (err) {
    if (err instanceof DvlaApiError) {
      throw err;
    }
    throw err;
  }
}

export const vehiclesRouter = new Hono()
  .get("/", async (c) => {
    const archived = c.req.query("archived") === "true";
    const all = archived
      ? await db.select().from(vehicles).where(isNotNull(vehicles.archivedAt)).orderBy(vehicles.archivedAt)
      : await db.select().from(vehicles).where(isNull(vehicles.archivedAt)).orderBy(vehicles.createdAt);
    return c.json(all);
  })

  .post("/", zValidator("json", addVehicleSchema), async (c) => {
    const data = c.req.valid("json");
    const now = new Date().toISOString();

    const existing = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.registrationNumber, data.registrationNumber))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "Vehicle already exists" }, 409);
    }

    const [inserted] = await db
      .insert(vehicles)
      .values({
        registrationNumber: data.registrationNumber,
        v5DocumentNumber: data.v5DocumentNumber ?? null,
        model: data.model ?? null,
        notes: data.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Fetch DVLA data in background (don't await — return immediately)
    refreshVehicleFromDvla(inserted.id, inserted.registrationNumber).catch(
      (err) => console.error("Initial DVLA fetch failed:", err)
    );

    return c.json(inserted, 201);
  })

  .get("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, id))
      .limit(1);

    if (!vehicle) return c.json({ error: "Not found" }, 404);
    return c.json(vehicle);
  })

  .put("/:id", zValidator("json", updateVehicleSchema), async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const data = c.req.valid("json");
    const now = new Date().toISOString();

    const [updated] = await db
      .update(vehicles)
      .set({ ...data, updatedAt: now })
      .where(eq(vehicles.id, id))
      .returning();

    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })

  .delete("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const [deleted] = await db
      .delete(vehicles)
      .where(eq(vehicles.id, id))
      .returning();

    if (!deleted) return c.json({ error: "Not found" }, 404);

    await deleteInsuranceCertificate(deleted.insuranceCertificateFilename);

    return c.json({ success: true });
  })

  .post("/:id/archive", zValidator("json", archiveVehicleSchema), async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const data = c.req.valid("json");
    const now = new Date().toISOString();

    const [updated] = await db
      .update(vehicles)
      .set({
        archivedAt: now,
        archiveReason: data.reason,
        saleDate: data.reason === "sold" ? (data.saleDate ?? null) : null,
        buyerName: data.reason === "sold" ? (data.buyerName ?? null) : null,
        buyerContact: data.reason === "sold" ? (data.buyerContact ?? null) : null,
        updatedAt: now,
      })
      .where(eq(vehicles.id, id))
      .returning();

    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })

  .post("/:id/unarchive", async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const now = new Date().toISOString();

    const [updated] = await db
      .update(vehicles)
      .set({
        archivedAt: null,
        archiveReason: null,
        saleDate: null,
        buyerName: null,
        buyerContact: null,
        updatedAt: now,
      })
      .where(eq(vehicles.id, id))
      .returning();

    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })

  .post("/:id/refresh", async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, id))
      .limit(1);

    if (!vehicle) return c.json({ error: "Not found" }, 404);

    try {
      const result = await refreshVehicleFromDvla(
        vehicle.id,
        vehicle.registrationNumber
      );

      const [updated] = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.id, id))
        .limit(1);

      return c.json({ ...result, vehicle: updated });
    } catch (err) {
      if (err instanceof DvlaApiError) {
        return c.json({ error: err.message }, err.status as 429 | 500);
      }
      return c.json({ error: "Failed to refresh from DVLA" }, 500);
    }
  })

  .post("/refresh-all", async (c) => {
    try {
      const result = await refreshAllVehicles();
      return c.json(result);
    } catch (err) {
      return c.json({ error: "Failed to refresh vehicles from DVLA" }, 500);
    }
  })

  .get("/:id/service-tasks", async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const tasks = await db
      .select()
      .from(serviceTasks)
      .where(eq(serviceTasks.vehicleId, id))
      .orderBy(serviceTasks.date);

    return c.json(tasks);
  })

  .post("/:id/service-tasks", zValidator("json", serviceTaskSchema), async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const [vehicle] = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(eq(vehicles.id, id))
      .limit(1);
    if (!vehicle) return c.json({ error: "Vehicle not found" }, 404);

    const data = c.req.valid("json");
    const now = new Date().toISOString();

    const [inserted] = await db
      .insert(serviceTasks)
      .values({
        vehicleId: id,
        type: data.type,
        date: data.date,
        mileage: data.mileage ?? null,
        cost: data.cost ?? null,
        notes: data.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json(inserted, 201);
  })

  .put(
    "/:id/service-tasks/:taskId",
    zValidator("json", updateServiceTaskSchema),
    async (c) => {
      const id = parseInt(c.req.param("id"));
      const taskId = parseInt(c.req.param("taskId"));
      if (isNaN(id) || isNaN(taskId)) return c.json({ error: "Invalid ID" }, 400);

      const data = c.req.valid("json");
      const now = new Date().toISOString();

      const [updated] = await db
        .update(serviceTasks)
        .set({ ...data, updatedAt: now })
        .where(and(eq(serviceTasks.id, taskId), eq(serviceTasks.vehicleId, id)))
        .returning();

      if (!updated) return c.json({ error: "Not found" }, 404);
      return c.json(updated);
    }
  )

  .delete("/:id/service-tasks/:taskId", async (c) => {
    const id = parseInt(c.req.param("id"));
    const taskId = parseInt(c.req.param("taskId"));
    if (isNaN(id) || isNaN(taskId)) return c.json({ error: "Invalid ID" }, 400);

    const [deleted] = await db
      .delete(serviceTasks)
      .where(and(eq(serviceTasks.id, taskId), eq(serviceTasks.vehicleId, id)))
      .returning();

    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ success: true });
  })

  .post("/:id/insurance-certificate", async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, id))
      .limit(1);
    if (!vehicle) return c.json({ error: "Vehicle not found" }, 404);

    let body: Record<string, string | File>;
    try {
      body = await c.req.parseBody();
    } catch {
      return c.json({ error: "Invalid multipart body" }, 400);
    }
    const file = body.file;
    if (!file || typeof file === "string") {
      return c.json({ error: "Missing file field" }, 400);
    }

    try {
      const saved = await saveInsuranceCertificate(id, file);
      const now = new Date().toISOString();

      const [updated] = await db
        .update(vehicles)
        .set({
          insuranceCertificateFilename: saved.filename,
          insuranceCertificateOriginalName: saved.originalName,
          insuranceCertificateMimeType: saved.mimeType,
          insuranceCertificateSize: saved.size,
          insuranceCertificateUploadedAt: now,
          updatedAt: now,
        })
        .where(eq(vehicles.id, id))
        .returning();

      await deleteInsuranceCertificate(vehicle.insuranceCertificateFilename);

      return c.json(updated);
    } catch (err) {
      if (err instanceof UploadsError) {
        return c.json({ error: err.message }, err.status);
      }
      throw err;
    }
  })

  .get("/:id/insurance-certificate", async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, id))
      .limit(1);
    if (!vehicle) return c.json({ error: "Vehicle not found" }, 404);
    if (!vehicle.insuranceCertificateFilename) {
      return c.json({ error: "No certificate uploaded" }, 404);
    }

    const absolutePath = resolveInsuranceCertificatePath(
      vehicle.insuranceCertificateFilename
    );
    if (!absolutePath) {
      return c.json({ error: "Certificate file missing on server" }, 404);
    }

    const buffer = await fs.promises.readFile(absolutePath);
    const filename = vehicle.insuranceCertificateOriginalName ?? vehicle.insuranceCertificateFilename;

    // RFC 6266: ASCII-only quoted fallback (with backslash + CR/LF + quote
    // stripped, then quotes/backslashes escaped) plus filename*=UTF-8'' for
    // clients that support it.
    const asciiFallback = filename
      .replace(/[\r\n]/g, "")
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/(["\\])/g, "\\$1");
    const utf8Encoded = encodeURIComponent(filename).replace(/['()]/g, escape);

    c.header(
      "Content-Type",
      vehicle.insuranceCertificateMimeType ?? "application/octet-stream"
    );
    c.header(
      "Content-Disposition",
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`
    );
    return c.body(buffer as unknown as ArrayBuffer);
  })

  .delete("/:id/insurance-certificate", async (c) => {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, id))
      .limit(1);
    if (!vehicle) return c.json({ error: "Vehicle not found" }, 404);

    await deleteInsuranceCertificate(vehicle.insuranceCertificateFilename);

    const now = new Date().toISOString();
    const [updated] = await db
      .update(vehicles)
      .set({
        insuranceCertificateFilename: null,
        insuranceCertificateOriginalName: null,
        insuranceCertificateMimeType: null,
        insuranceCertificateSize: null,
        insuranceCertificateUploadedAt: null,
        updatedAt: now,
      })
      .where(eq(vehicles.id, id))
      .returning();

    return c.json(updated);
  });
