/**
 * Populate the local SQLite database with realistic dummy vehicles and
 * service history for manual testing.
 *
 * Usage:
 *   npm run seed              # add seed data, skipping any reg numbers that already exist
 *   npm run seed -- --clear   # delete ALL vehicles + service tasks first, then reseed
 *
 * Refuses to run when NODE_ENV=production. Does not touch the users table.
 */

import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production.");
  process.exit(1);
}

const clear = process.argv.includes("--clear");

const DB_PATH = process.env.DATABASE_URL ?? "./vehicles.db";
const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite, { schema });

const today = new Date();
const iso = (d: Date) => d.toISOString();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const days = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};
const months = (n: number) => {
  const d = new Date(today);
  d.setMonth(d.getMonth() + n);
  return d;
};

interface SeedVehicle {
  registrationNumber: string;
  make: string;
  model: string;
  colour: string;
  yearOfManufacture: number;
  fuelType: string;
  engineCapacity: number;
  taxStatus: string | null;
  taxDueDate: string | null;
  motStatus: string | null;
  motExpiryDate: string | null;
  insuranceExpiryDate: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insurancePremium: number | null; // pence
  serviceDate: string | null;
  serviceIntervalMonths: number | null;
  manualSorn?: boolean;
  notes: string | null;
  archive?: {
    reason: "sold" | "scrapped" | "other";
    archivedAt: string;
    saleDate?: string | null;
    buyerName?: string | null;
    buyerContact?: string | null;
  };
  serviceHistory: Array<{
    type: string;
    date: string;
    mileage: number | null;
    cost: number | null; // pence
    notes: string | null;
  }>;
}

const SEED: SeedVehicle[] = [
  {
    registrationNumber: "AB12CDE",
    make: "Volkswagen",
    model: "Golf GTI",
    colour: "Tornado Red",
    yearOfManufacture: 2019,
    fuelType: "PETROL",
    engineCapacity: 1984,
    taxStatus: "Taxed",
    taxDueDate: isoDate(months(8)),
    motStatus: "Valid",
    motExpiryDate: isoDate(months(7)),
    insuranceExpiryDate: isoDate(months(9)),
    insuranceProvider: "Admiral",
    insurancePolicyNumber: "ADM-204716-A",
    insurancePremium: 56200,
    serviceDate: isoDate(months(4)),
    serviceIntervalMonths: 12,
    notes: "Daily driver. Recently fitted with Michelin Pilot Sport 4.",
    serviceHistory: [
      { type: "Oil Change", date: isoDate(months(-2)), mileage: 48200, cost: 8500, notes: "Castrol Edge 5W-30" },
      { type: "Brake Pads", date: isoDate(months(-6)), mileage: 45100, cost: 19500, notes: "Front pads + sensors" },
      { type: "Full Service", date: isoDate(months(-12)), mileage: 41800, cost: 32500, notes: "Halfords Autocentre" },
      { type: "Tyres", date: isoDate(months(-3)), mileage: 47200, cost: 64000, notes: "Set of 4 Michelin Pilot Sport 4 225/40R18" },
    ],
  },
  {
    registrationNumber: "BD68FGH",
    make: "Ford",
    model: "Fiesta ST-Line",
    colour: "Magnetic Grey",
    yearOfManufacture: 2018,
    fuelType: "PETROL",
    engineCapacity: 998,
    taxStatus: "Taxed",
    taxDueDate: isoDate(days(7)),
    motStatus: "Valid",
    motExpiryDate: isoDate(days(14)),
    insuranceExpiryDate: isoDate(days(21)),
    insuranceProvider: "Direct Line",
    insurancePolicyNumber: "DL-7782-001",
    insurancePremium: 41800,
    serviceDate: isoDate(days(45)),
    serviceIntervalMonths: 12,
    notes: "Partner's car. Tax + MOT both due imminently — dashboard alerts.",
    serviceHistory: [
      { type: "Interim Service", date: isoDate(months(-5)), mileage: 62000, cost: 14500, notes: null },
      { type: "Brake Discs", date: isoDate(months(-9)), mileage: 59800, cost: 28500, notes: "Front discs + pads — main dealer" },
    ],
  },
  {
    registrationNumber: "GK14JKL",
    make: "Vauxhall",
    model: "Corsa SE",
    colour: "Silver Lake",
    yearOfManufacture: 2014,
    fuelType: "PETROL",
    engineCapacity: 1398,
    taxStatus: "Untaxed",
    taxDueDate: isoDate(days(-45)),
    motStatus: "Not valid",
    motExpiryDate: isoDate(days(-30)),
    insuranceExpiryDate: isoDate(days(-15)),
    insuranceProvider: "Hastings Direct",
    insurancePolicyNumber: null,
    insurancePremium: null,
    serviceDate: isoDate(days(-90)),
    serviceIntervalMonths: 12,
    notes: "Daughter's first car — sat off the road while we sort the head gasket. All dates expired.",
    serviceHistory: [
      { type: "Cambelt", date: isoDate(months(-18)), mileage: 92400, cost: 48500, notes: "Cambelt + water pump" },
      { type: "Full Service", date: isoDate(months(-24)), mileage: 87600, cost: 26000, notes: null },
    ],
  },
  {
    registrationNumber: "MN66PQR",
    make: "MINI",
    model: "Cooper S",
    colour: "Chili Red",
    yearOfManufacture: 2016,
    fuelType: "PETROL",
    engineCapacity: 1998,
    taxStatus: "SORN",
    taxDueDate: null,
    motStatus: "Valid",
    motExpiryDate: isoDate(months(5)),
    insuranceExpiryDate: null,
    insuranceProvider: null,
    insurancePolicyNumber: null,
    insurancePremium: null,
    serviceDate: null,
    serviceIntervalMonths: null,
    manualSorn: true,
    notes: "Project car — declared SORN while engine work is ongoing.",
    serviceHistory: [
      { type: "Spark Plugs", date: isoDate(months(-4)), mileage: 78400, cost: 7500, notes: "NGK iridium x4" },
      { type: "Coolant Flush", date: isoDate(months(-7)), mileage: 77100, cost: 6000, notes: null },
    ],
  },
  {
    registrationNumber: "ST20UVW",
    make: "Toyota",
    model: "Yaris Hybrid",
    colour: "Pearl White",
    yearOfManufacture: 2020,
    fuelType: "HYBRID ELECTRIC",
    engineCapacity: 1490,
    taxStatus: "Taxed",
    taxDueDate: isoDate(months(3)),
    motStatus: "Valid",
    motExpiryDate: isoDate(months(11)),
    insuranceExpiryDate: isoDate(months(6)),
    insuranceProvider: "LV=",
    insurancePolicyNumber: "LV-882003-9",
    insurancePremium: 38000,
    serviceDate: null,
    serviceIntervalMonths: null,
    notes: "Sold to a colleague in March 2026.",
    archive: {
      reason: "sold",
      archivedAt: iso(days(-60)),
      saleDate: isoDate(days(-60)),
      buyerName: "Sam Patel",
      buyerContact: "07700 900142",
    },
    serviceHistory: [
      { type: "Full Service", date: isoDate(months(-8)), mileage: 24500, cost: 21500, notes: "Toyota dealer service" },
    ],
  },
  {
    registrationNumber: "WX99YZB",
    make: "Honda",
    model: "Civic 1.4 SE",
    colour: "Cosmic Blue",
    yearOfManufacture: 2007,
    fuelType: "PETROL",
    engineCapacity: 1339,
    taxStatus: "Untaxed",
    taxDueDate: null,
    motStatus: "Not valid",
    motExpiryDate: null,
    insuranceExpiryDate: null,
    insuranceProvider: null,
    insurancePolicyNumber: null,
    insurancePremium: null,
    serviceDate: null,
    serviceIntervalMonths: null,
    notes: "Old runaround — scrapped after rust around the rear arches got out of hand.",
    archive: {
      reason: "scrapped",
      archivedAt: iso(days(-180)),
    },
    serviceHistory: [],
  },
];

async function main() {
  if (clear) {
    console.log("Clearing existing vehicles and service tasks…");
    await db.delete(schema.serviceTasks);
    await db.delete(schema.vehicles);
  }

  const existing = await db
    .select({ reg: schema.vehicles.registrationNumber })
    .from(schema.vehicles)
    .where(
      inArray(
        schema.vehicles.registrationNumber,
        SEED.map((v) => v.registrationNumber)
      )
    );
  const existingRegs = new Set(existing.map((r) => r.reg));

  let inserted = 0;
  let skipped = 0;
  let tasksInserted = 0;

  const now = new Date().toISOString();

  for (const v of SEED) {
    if (existingRegs.has(v.registrationNumber)) {
      skipped++;
      console.log(`  · ${v.registrationNumber} already exists — skipped`);
      continue;
    }

    const [row] = await db
      .insert(schema.vehicles)
      .values({
        registrationNumber: v.registrationNumber,
        make: v.make,
        model: v.model,
        colour: v.colour,
        yearOfManufacture: v.yearOfManufacture,
        fuelType: v.fuelType,
        engineCapacity: v.engineCapacity,
        taxStatus: v.taxStatus,
        taxDueDate: v.taxDueDate,
        motStatus: v.motStatus,
        motExpiryDate: v.motExpiryDate,
        insuranceExpiryDate: v.insuranceExpiryDate,
        insuranceProvider: v.insuranceProvider,
        insurancePolicyNumber: v.insurancePolicyNumber,
        insurancePremium: v.insurancePremium,
        serviceDate: v.serviceDate,
        serviceIntervalMonths: v.serviceIntervalMonths,
        manualSorn: v.manualSorn ?? false,
        notes: v.notes,
        dvlaLastRefreshed: now,
        archivedAt: v.archive?.archivedAt ?? null,
        archiveReason: v.archive?.reason ?? null,
        saleDate: v.archive?.saleDate ?? null,
        buyerName: v.archive?.buyerName ?? null,
        buyerContact: v.archive?.buyerContact ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schema.vehicles.id });

    for (const t of v.serviceHistory) {
      await db.insert(schema.serviceTasks).values({
        vehicleId: row.id,
        type: t.type,
        date: t.date,
        mileage: t.mileage,
        cost: t.cost,
        notes: t.notes,
        createdAt: now,
        updatedAt: now,
      });
      tasksInserted++;
    }

    inserted++;
    console.log(`  ✓ ${v.registrationNumber}  ${v.make} ${v.model}  (${v.serviceHistory.length} service records)`);
  }

  console.log("");
  console.log(`Inserted ${inserted} vehicle(s) and ${tasksInserted} service task(s). ${skipped} skipped.`);
  if (!clear && skipped > 0) {
    console.log("Re-run with --clear to wipe and reseed.");
  }
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
