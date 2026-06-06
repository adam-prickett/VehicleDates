import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const tempUploads = fs.mkdtempSync(path.join(os.tmpdir(), "vehicle-dates-test-"));
process.env.UPLOADS_DIR = tempUploads;

vi.mock("bcryptjs", () => ({
  default: {
    hash: async (pwd: string) => `hashed:${pwd}`,
    compare: async (pwd: string, hash: string) => hash === `hashed:${pwd}`,
  },
}));

vi.mock("../db/client.js", async () => {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const schema = await import("../db/schema.js");
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return { db };
});

vi.mock("../services/dvla.js", () => ({
  fetchDvlaVehicle: vi.fn().mockResolvedValue(null),
  getEffectiveApiKey: vi.fn().mockResolvedValue("test-key"),
  DvlaApiError: class DvlaApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { makeApp, post, get, put, del, extractCookie } from "./helpers.js";
import { insuranceDir } from "../lib/uploads.js";

const app = makeApp();

beforeAll(() => {
  fs.mkdirSync(insuranceDir(), { recursive: true });
});

afterAll(() => {
  fs.rmSync(tempUploads, { recursive: true, force: true });
});

async function clearDb() {
  await db.delete(schema.vehicles);
  await db.delete(schema.users);
  // Wipe the insurance dir between tests
  for (const f of fs.readdirSync(insuranceDir())) {
    fs.unlinkSync(path.join(insuranceDir(), f));
  }
}

beforeEach(clearDb);

async function adminCookie() {
  const res = await post(app, "/auth/setup", { username: "admin", password: "password123" });
  return extractCookie(res);
}

async function createVehicle(cookie: string, reg = "AA11AAA") {
  const res = await post(app, "/vehicles", { registrationNumber: reg }, cookie);
  return (await res.json()) as { id: number };
}

function pdfFile(name = "policy.pdf", size = 32): File {
  // Minimal valid-ish PDF header so this is treated as a file with real bytes
  const buf = Buffer.alloc(size, 0x20);
  buf.write("%PDF-1.4", 0);
  return new File([buf], name, { type: "application/pdf" });
}

async function uploadCertificate(app: ReturnType<typeof makeApp>, id: number, file: File, cookie: string) {
  const form = new FormData();
  form.append("file", file);
  return app.request(`/vehicles/${id}/insurance-certificate`, {
    method: "POST",
    headers: {
      origin: "http://localhost",
      ...(cookie ? { cookie } : {}),
    },
    body: form,
  });
}

// ─── Policy fields via PUT /vehicles/:id ──────────────────────────────────────

describe("PUT /vehicles/:id with insurance policy fields", () => {
  it("saves policy number and premium", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const res = await put(
      app,
      `/vehicles/${id}`,
      { insurancePolicyNumber: "ABC-12345678", insurancePremium: 48000 },
      cookie
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insurancePolicyNumber).toBe("ABC-12345678");
    expect(body.insurancePremium).toBe(48000);
  });

  it("allows null to clear policy fields", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    await put(app, `/vehicles/${id}`, { insurancePolicyNumber: "X", insurancePremium: 1000 }, cookie);

    const res = await put(
      app,
      `/vehicles/${id}`,
      { insurancePolicyNumber: null, insurancePremium: null },
      cookie
    );
    const body = await res.json();
    expect(body.insurancePolicyNumber).toBeNull();
    expect(body.insurancePremium).toBeNull();
  });

  it("returns 400 for negative premium", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const res = await put(app, `/vehicles/${id}`, { insurancePremium: -100 }, cookie);
    expect(res.status).toBe(400);
  });
});

// ─── Upload certificate ───────────────────────────────────────────────────────

describe("POST /vehicles/:id/insurance-certificate", () => {
  it("uploads a PDF and populates certificate metadata", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const res = await uploadCertificate(app, id, pdfFile("my-policy.pdf", 128), cookie);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.insuranceCertificateFilename).toMatch(/^vehicle-\d+-[a-f0-9]+\.pdf$/);
    expect(body.insuranceCertificateOriginalName).toBe("my-policy.pdf");
    expect(body.insuranceCertificateMimeType).toBe("application/pdf");
    expect(body.insuranceCertificateSize).toBe(128);
    expect(body.insuranceCertificateUploadedAt).toBeTypeOf("string");

    const onDisk = path.join(insuranceDir(), body.insuranceCertificateFilename);
    expect(fs.existsSync(onDisk)).toBe(true);
    expect(fs.statSync(onDisk).size).toBe(128);
  });

  it("returns 415 for an unsupported mime type", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const txt = new File([Buffer.from("hello")], "notes.txt", { type: "text/plain" });
    const res = await uploadCertificate(app, id, txt, cookie);
    expect(res.status).toBe(415);
  });

  it("returns 415 when file contents do not match an allowed format", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    // Declared as PDF but contents are HTML
    const sneaky = new File(
      [Buffer.from("<html><script>alert(1)</script></html>")],
      "malicious.pdf",
      { type: "application/pdf" }
    );
    const res = await uploadCertificate(app, id, sneaky, cookie);
    expect(res.status).toBe(415);
  });

  it("returns 415 when declared and detected types disagree", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    // Real PNG bytes, but declared as JPEG
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
    const mismatched = new File([png], "image.jpg", { type: "image/jpeg" });
    const res = await uploadCertificate(app, id, mismatched, cookie);
    expect(res.status).toBe(415);
  });

  it("accepts a real PNG", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const file = new File([png], "cert.png", { type: "image/png" });
    const res = await uploadCertificate(app, id, file, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insuranceCertificateMimeType).toBe("image/png");
  });

  it("accepts a real JPEG", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 0)]);
    const file = new File([jpeg], "cert.jpg", { type: "image/jpeg" });
    const res = await uploadCertificate(app, id, file, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insuranceCertificateMimeType).toBe("image/jpeg");
  });

  it("accepts a real HEIC and stores canonical mime", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    // ftypheic at offset 4
    const heic = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x20]),
      Buffer.from("ftypheic", "ascii"),
      Buffer.alloc(60, 0),
    ]);
    const file = new File([heic], "cert.heic", { type: "image/heic" });
    const res = await uploadCertificate(app, id, file, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insuranceCertificateMimeType).toBe("image/heic");
  });

  it("returns 413 for a file larger than the 10 MB limit", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const big = pdfFile("big.pdf", 10 * 1024 * 1024 + 1);
    const res = await uploadCertificate(app, id, big, cookie);
    expect(res.status).toBe(413);
  });

  it("returns 400 when the file field is missing", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const form = new FormData();
    form.append("other", "x");
    const res = await app.request(`/vehicles/${id}/insurance-certificate`, {
      method: "POST",
      headers: { cookie, origin: "http://localhost" },
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the vehicle does not exist", async () => {
    const cookie = await adminCookie();
    const res = await uploadCertificate(app, 99999, pdfFile(), cookie);
    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const form = new FormData();
    form.append("file", pdfFile());
    const res = await app.request(`/vehicles/${id}/insurance-certificate`, {
      method: "POST",
      headers: { origin: "http://localhost" },
      body: form,
    });
    expect(res.status).toBe(401);
  });

  it("replacing a certificate deletes the previous file", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);

    const first = await (await uploadCertificate(app, id, pdfFile("a.pdf"), cookie)).json();
    const oldPath = path.join(insuranceDir(), first.insuranceCertificateFilename);
    expect(fs.existsSync(oldPath)).toBe(true);

    const second = await (await uploadCertificate(app, id, pdfFile("b.pdf"), cookie)).json();
    expect(second.insuranceCertificateFilename).not.toBe(first.insuranceCertificateFilename);

    expect(fs.existsSync(oldPath)).toBe(false);
    const newPath = path.join(insuranceDir(), second.insuranceCertificateFilename);
    expect(fs.existsSync(newPath)).toBe(true);
  });
});

// ─── Download certificate ─────────────────────────────────────────────────────

describe("GET /vehicles/:id/insurance-certificate", () => {
  it("returns the file with mime type and original filename", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    await uploadCertificate(app, id, pdfFile("renewal-2026.pdf", 64), cookie);

    const res = await get(app, `/vehicles/${id}/insurance-certificate`, cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("renewal-2026.pdf");

    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(64);
  });

  it("emits an RFC 6266 header with both ASCII fallback and UTF-8 filename*", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    // Original name contains a non-ASCII character and a special quoting character
    await uploadCertificate(app, id, pdfFile('renewal-£"2026.pdf', 64), cookie);

    const res = await get(app, `/vehicles/${id}/insurance-certificate`, cookie);
    expect(res.status).toBe(200);
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toMatch(/^attachment;/);
    // ASCII fallback must NOT contain a raw double-quote or non-ASCII bytes
    const fallback = cd.match(/filename="([^"]*)"/)?.[1] ?? "";
    expect(fallback).not.toMatch(/[^\x20-\x7E]/);
    expect(fallback).not.toContain('"');
    // filename* must be present and URL-encode the non-ASCII byte
    expect(cd).toMatch(/filename\*=UTF-8''/);
    expect(cd).toContain("%C2%A3"); // UTF-8 of £
  });

  it("returns 404 when no certificate is uploaded", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const res = await get(app, `/vehicles/${id}/insurance-certificate`, cookie);
    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    await uploadCertificate(app, id, pdfFile(), cookie);
    const res = await get(app, `/vehicles/${id}/insurance-certificate`);
    expect(res.status).toBe(401);
  });
});

// ─── Delete certificate ───────────────────────────────────────────────────────

describe("DELETE /vehicles/:id/insurance-certificate", () => {
  it("removes the file and clears the DB columns", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const uploaded = await (await uploadCertificate(app, id, pdfFile(), cookie)).json();
    const onDisk = path.join(insuranceDir(), uploaded.insuranceCertificateFilename);
    expect(fs.existsSync(onDisk)).toBe(true);

    const res = await del(app, `/vehicles/${id}/insurance-certificate`, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insuranceCertificateFilename).toBeNull();
    expect(body.insuranceCertificateOriginalName).toBeNull();
    expect(body.insuranceCertificateMimeType).toBeNull();
    expect(body.insuranceCertificateSize).toBeNull();
    expect(body.insuranceCertificateUploadedAt).toBeNull();

    expect(fs.existsSync(onDisk)).toBe(false);
  });

  it("is idempotent when no certificate exists", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const res = await del(app, `/vehicles/${id}/insurance-certificate`, cookie);
    expect(res.status).toBe(200);
    expect((await res.json()).insuranceCertificateFilename).toBeNull();
  });
});

// ─── Cleanup when vehicle is deleted ──────────────────────────────────────────

describe("DELETE /vehicles/:id with a certificate", () => {
  it("removes the certificate file from disk", async () => {
    const cookie = await adminCookie();
    const { id } = await createVehicle(cookie);
    const uploaded = await (await uploadCertificate(app, id, pdfFile(), cookie)).json();
    const onDisk = path.join(insuranceDir(), uploaded.insuranceCertificateFilename);
    expect(fs.existsSync(onDisk)).toBe(true);

    const res = await del(app, `/vehicles/${id}`, cookie);
    expect(res.status).toBe(200);
    expect(fs.existsSync(onDisk)).toBe(false);
  });
});
