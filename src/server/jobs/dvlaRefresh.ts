import cron from "node-cron";
import { db } from "../db/client.js";
import { vehicles } from "../db/schema.js";
import { fetchDvlaVehicle } from "../services/dvla.js";
import { eq } from "drizzle-orm";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function refreshAllVehicles(): Promise<{
  success: number;
  failed: number;
}> {
  const all = await db.select().from(vehicles);
  let success = 0;
  let failed = 0;

  for (const vehicle of all) {
    try {
      const dvlaData = await fetchDvlaVehicle(vehicle.registrationNumber);
      const now = new Date().toISOString();

      if (dvlaData) {
        await db
          .update(vehicles)
          .set({
            make: dvlaData.make ?? vehicle.make,
            colour: dvlaData.colour ?? vehicle.colour,
            yearOfManufacture:
              dvlaData.yearOfManufacture ?? vehicle.yearOfManufacture,
            fuelType: dvlaData.fuelType ?? vehicle.fuelType,
            engineCapacity: dvlaData.engineCapacity ?? vehicle.engineCapacity,
            co2Emissions: dvlaData.co2Emissions ?? vehicle.co2Emissions,
            dateOfLastV5CIssued:
              dvlaData.dateOfLastV5CIssued ?? vehicle.dateOfLastV5CIssued,
            taxStatus: dvlaData.taxStatus ?? vehicle.taxStatus,
            taxDueDate: dvlaData.taxDueDate ?? vehicle.taxDueDate,
            motStatus: dvlaData.motStatus ?? vehicle.motStatus,
            motExpiryDate: dvlaData.motExpiryDate ?? vehicle.motExpiryDate,
            dvlaLastRefreshed: now,
            updatedAt: now,
          })
          .where(eq(vehicles.id, vehicle.id));
      } else {
        await db
          .update(vehicles)
          .set({ dvlaLastRefreshed: now, updatedAt: now })
          .where(eq(vehicles.id, vehicle.id));
      }

      success++;
    } catch (err) {
      console.error(
        `Failed to refresh ${vehicle.registrationNumber}:`,
        err
      );
      failed++;
    }

    // Rate-limit safe: 600ms between calls
    await sleep(600);
  }

  return { success, failed };
}

export function startScheduledRefresh() {
  // Run daily at 3:00 AM
  cron.schedule("0 3 * * *", async () => {
    console.log("[Scheduler] Starting nightly DVLA refresh...");
    const result = await refreshAllVehicles();
    console.log(
      `[Scheduler] DVLA refresh complete: ${result.success} success, ${result.failed} failed`
    );
  });

  console.log("[Scheduler] Nightly DVLA refresh scheduled at 03:00");
}
