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

  const dir = insuranceDir();
  ensureDir(dir);

  const ext = extensionFor(file.type, file.name);
  const filename = `vehicle-${vehicleId}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const absolutePath = path.join(dir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.promises.writeFile(absolutePath, buffer);

  return {
    filename,
    absolutePath,
    size: file.size,
    mimeType: file.type,
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
