import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const vehicles = sqliteTable("vehicles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  registrationNumber: text("registration_number").notNull().unique(),
  v5DocumentNumber: text("v5_document_number"),
  // User-entered fields
  model: text("model"),
  notes: text("notes"),
  // DVLA-sourced fields
  make: text("make"),
  colour: text("colour"),
  yearOfManufacture: integer("year_of_manufacture"),
  fuelType: text("fuel_type"),
  engineCapacity: integer("engine_capacity"),
  co2Emissions: integer("co2_emissions"),
  dateOfLastV5CIssued: text("date_of_last_v5c_issued"),
  // Tax info (DVLA)
  taxStatus: text("tax_status"),
  taxDueDate: text("tax_due_date"),
  // MOT info (DVLA)
  motStatus: text("mot_status"),
  motExpiryDate: text("mot_expiry_date"),
  // User-managed dates
  insuranceExpiryDate: text("insurance_expiry_date"),
  insuranceProvider: text("insurance_provider"),
  serviceDate: text("service_date"),
  serviceIntervalMonths: integer("service_interval_months"),
  // SORN status (manual override; DVLA taxStatus "SORN" is also respected)
  manualSorn: integer("manual_sorn", { mode: "boolean" }).default(false),
  // Archive fields
  archivedAt: text("archived_at"),
  archiveReason: text("archive_reason"), // 'sold' | 'scrapped' | 'other'
  saleDate: text("sale_date"),
  buyerName: text("buyer_name"),
  buyerContact: text("buyer_contact"),
  // Metadata
  dvlaLastRefreshed: text("dvla_last_refreshed"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
