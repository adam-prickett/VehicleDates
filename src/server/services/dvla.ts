import { z } from "zod";
import { getSetting } from "../db/settingsHelper.js";

const DVLA_API_URL =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

export async function getEffectiveApiKey(): Promise<string | null> {
  const dbKey = await getSetting("dvla_api_key");
  return dbKey || process.env.DVLA_API_KEY || null;
}

const DvlaResponseSchema = z.object({
  registrationNumber: z.string(),
  taxStatus: z.string().optional(),
  taxDueDate: z.string().optional(),
  motStatus: z.string().optional(),
  motExpiryDate: z.string().optional(),
  make: z.string().optional(),
  colour: z.string().optional(),
  yearOfManufacture: z.number().int().optional(),
  engineCapacity: z.number().int().optional(),
  co2Emissions: z.number().int().optional(),
  fuelType: z.string().optional(),
  markedForExport: z.boolean().optional(),
  typeApproval: z.string().optional(),
  wheelplan: z.string().optional(),
  monthOfFirstRegistration: z.string().optional(),
  dateOfLastV5CIssued: z.string().optional(),
});

export type DvlaVehicleData = z.infer<typeof DvlaResponseSchema>;

export class DvlaApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "DvlaApiError";
  }
}

function sanitiseReg(reg: string): string {
  return reg.replace(/\s+/g, "").toUpperCase();
}

export async function fetchDvlaVehicle(
  registrationNumber: string
): Promise<DvlaVehicleData | null> {
  const apiKey = await getEffectiveApiKey();
  if (!apiKey) {
    throw new Error(
      "DVLA API key is not configured. Please add it in Settings."
    );
  }

  const reg = sanitiseReg(registrationNumber);

  const response = await fetch(DVLA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ registrationNumber: reg }),
  });

  if (response.status === 404) {
    return null;
  }

  if (response.status === 429) {
    throw new DvlaApiError(429, "DVLA API rate limit exceeded. Try again later.");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new DvlaApiError(
      response.status,
      `DVLA API error ${response.status}: ${body}`
    );
  }

  const json = await response.json();
  const parsed = DvlaResponseSchema.safeParse(json);

  if (!parsed.success) {
    console.error("DVLA response parse error:", parsed.error);
    throw new Error("Unexpected DVLA API response format");
  }

  return parsed.data;
}
