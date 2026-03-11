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
  serviceDate: string | null;
  serviceIntervalMonths: number | null;
  manualSorn: boolean | null;
  dvlaLastRefreshed: string | null;
  createdAt: string;
  updatedAt: string;
}
