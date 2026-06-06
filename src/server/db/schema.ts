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
  insurancePolicyNumber: text("insurance_policy_number"),
  insurancePremium: integer("insurance_premium"),
  insuranceCertificateFilename: text("insurance_certificate_filename"),
  insuranceCertificateOriginalName: text("insurance_certificate_original_name"),
  insuranceCertificateMimeType: text("insurance_certificate_mime_type"),
  insuranceCertificateSize: integer("insurance_certificate_size"),
  insuranceCertificateUploadedAt: text("insurance_certificate_uploaded_at"),
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

export const serviceTasks = sqliteTable("service_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  date: text("date").notNull(),
  mileage: integer("mileage"),
  cost: integer("cost"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type ServiceTask = typeof serviceTasks.$inferSelect;
export type InsertServiceTask = typeof serviceTasks.$inferInsert;

export type User = typeof users.$inferSelect;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const notificationChannels = sqliteTable("notification_channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "ntfy" | "pushover" | ...
  label: text("label").notNull(),
  config: text("config").notNull(), // JSON, provider-specific
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  // JSON int arrays — days before the event to send a notification
  leadDaysTax: text("lead_days_tax").notNull().default("[30,7,0]"),
  leadDaysMot: text("lead_days_mot").notNull().default("[30,7,0]"),
  leadDaysInsurance: text("lead_days_insurance").notNull().default("[30,7,0]"),
  leadDaysService: text("lead_days_service").notNull().default("[14,0]"),
  sendHour: integer("send_hour").notNull().default(9), // 0-23 local
  sendMinute: integer("send_minute").notNull().default(0), // 0-59 local
  timezone: text("timezone").notNull().default("Europe/London"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const notificationLog = sqliteTable("notification_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  eventType: text("event_type", {
    enum: ["tax", "mot", "insurance", "service"],
  }).notNull(),
  eventDate: text("event_date").notNull(),
  leadDays: integer("lead_days").notNull(),
  channelId: integer("channel_id")
    .notNull()
    .references(() => notificationChannels.id, { onDelete: "cascade" }),
  sentAt: text("sent_at").notNull().default(sql`(datetime('now'))`),
  status: text("status", { enum: ["sent", "failed"] }).notNull(),
  error: text("error"),
});

export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type NotificationLog = typeof notificationLog.$inferSelect;
