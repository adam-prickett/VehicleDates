import fs from "fs";
import path from "path";
import crypto from "crypto";

export const ALLOWED_CERTIFICATE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

export const MAX_CERTIFICATE_SIZE = 10 * 1024 * 1024; // 10 MB

// HEIF brands that map to image/heic vs image/heif (per ISO/IEC 14496-12 + 23008-12)
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx"]);
const HEIF_BRANDS = new Set(["mif1", "msf1", "heim", "heis", "hevm", "hevs"]);

function startsWith(buf: Buffer, prefix: number[], offset = 0): boolean {
  if (buf.length < offset + prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (buf[offset + i] !== prefix[i]) return false;
  }
  return true;
}

/**
 * Inspect the leading bytes of an uploaded buffer and return the canonical
 * MIME type if it matches a supported certificate format. Returns null when
 * the contents cannot be identified as one of the allowed types.
 */
export function sniffCertificateMimeType(buf: Buffer): string | null {
  // PDF: "%PDF-"
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "application/pdf";
  }
  // JPEG: FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // HEIF family: "ftyp" at offset 4, then a 4-byte brand identifier
  if (buf.length >= 12 && startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = buf.slice(8, 12).toString("ascii").toLowerCase();
    if (HEIC_BRANDS.has(brand)) return "image/heic";
    if (HEIF_BRANDS.has(brand)) return "image/heif";
  }
  return null;
}

export class UploadsError extends Error {
  status: 400 | 413 | 415;
  constructor(status: 400 | 413 | 415, message: string) {
    super(message);
    this.status = status;
  }
}

function rootDir(): string {
  return process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), "uploads");
}

export function insuranceDir(): string {
  return path.join(rootDir(), "insurance");
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function extensionFor(mime: string, fallbackName: string): string {
  switch (mime) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    default: {
      const ext = path.extname(fallbackName);
      return ext || "";
    }
  }
}

export interface SavedFile {
  filename: string;
  absolutePath: string;
  size: number;
  mimeType: string;
  originalName: string;
}

export async function saveInsuranceCertificate(
  vehicleId: number,
  file: File
): Promise<SavedFile> {
  if (!ALLOWED_CERTIFICATE_MIME_TYPES.has(file.type)) {
    throw new UploadsError(
      415,
      "Unsupported file type. Allowed: PDF, JPEG, PNG, HEIC."
    );
  }
  if (file.size <= 0) {
    throw new UploadsError(400, "Empty file");
  }
  if (file.size > MAX_CERTIFICATE_SIZE) {
    throw new UploadsError(
      413,
      `File too large. Maximum is ${MAX_CERTIFICATE_SIZE / (1024 * 1024)} MB.`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffCertificateMimeType(buffer);
  if (!sniffed) {
    throw new UploadsError(
      415,
      "File contents do not match a supported certificate format."
    );
  }
  // HEIC and HEIF browsers report interchangeably; otherwise require exact match
  const declared = file.type;
  const heifFamily = declared === "image/heic" || declared === "image/heif";
  const sniffedHeif = sniffed === "image/heic" || sniffed === "image/heif";
  if (sniffed !== declared && !(heifFamily && sniffedHeif)) {
    throw new UploadsError(
      415,
      "Declared and detected file types disagree."
    );
  }

  const dir = insuranceDir();
  ensureDir(dir);

  const ext = extensionFor(sniffed, file.name);
  const filename = `vehicle-${vehicleId}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const absolutePath = path.join(dir, filename);

  await fs.promises.writeFile(absolutePath, buffer);

  return {
    filename,
    absolutePath,
    size: file.size,
    mimeType: sniffed,
    originalName: file.name || filename,
  };
}

export function resolveInsuranceCertificatePath(filename: string): string | null {
  const dir = insuranceDir();
  const resolved = path.resolve(dir, filename);
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

export async function deleteInsuranceCertificate(filename: string | null): Promise<void> {
  if (!filename) return;
  const resolved = resolveInsuranceCertificatePath(filename);
  if (!resolved) return;
  try {
    await fs.promises.unlink(resolved);
  } catch {
    // file already gone — ignore
  }
}
