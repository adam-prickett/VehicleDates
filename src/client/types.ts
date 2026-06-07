export interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "user";
}

export interface User {
  id: number;
  username: string;
  role: "admin" | "user";
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: number;
  registrationNumber: string;
  v5DocumentNumber: string | null;
  model: string | null;
  notes: string | null;
  make: string | null;
  colour: string | null;
  yearOfManufacture: number | null;
  fuelType: string | null;
  engineCapacity: number | null;
  co2Emissions: number | null;
  dateOfLastV5CIssued: string | null;
  taxStatus: string | null;
  taxDueDate: string | null;
  motStatus: string | null;
  motExpiryDate: string | null;
  insuranceExpiryDate: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insurancePremium: number | null;
  insuranceCertificateFilename: string | null;
  insuranceCertificateOriginalName: string | null;
  insuranceCertificateMimeType: string | null;
  insuranceCertificateSize: number | null;
  insuranceCertificateUploadedAt: string | null;
  serviceDate: string | null;
  serviceIntervalMonths: number | null;
  manualSorn: boolean | null;
  archivedAt: string | null;
  archiveReason: string | null;
  saleDate: string | null;
  buyerName: string | null;
  buyerContact: string | null;
  dvlaLastRefreshed: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceTask {
  id: number;
  vehicleId: number;
  type: string;
  date: string;
  mileage: number | null;
  cost: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NotificationFieldType = "text" | "password" | "url";

export interface NotificationFieldSpec {
  name: string;
  label: string;
  type: NotificationFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  defaultValue?: string;
}

export interface NotificationProvider {
  type: string;
  label: string;
  description?: string;
  fields: NotificationFieldSpec[];
}

export interface NotificationChannel {
  id: number;
  type: string;
  label: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  leadDaysTax: number[];
  leadDaysMot: number[];
  leadDaysInsurance: number[];
  leadDaysService: number[];
  sendHour: number;
  sendMinute: number;
  timezone: string;
  updatedAt: string;
}

export type NotificationEventType = "tax" | "mot" | "insurance" | "service";

export interface NotificationLogEntry {
  id: number;
  userId: number;
  vehicleId: number;
  eventType: NotificationEventType;
  eventDate: string;
  leadDays: number;
  channelId: number;
  sentAt: string;
  status: "sent" | "failed";
  error: string | null;
}

export interface NotificationRunSummary {
  userId: number;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ vehicleId: number; eventType: NotificationEventType; channelId: number; message: string }>;
}
