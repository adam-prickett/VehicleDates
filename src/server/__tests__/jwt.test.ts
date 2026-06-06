import { describe, it, expect, afterEach } from "vitest";
import { signToken, verifyToken } from "../lib/jwt.js";

describe("signToken / verifyToken", () => {
  const payload = { sub: "42", username: "alice", role: "admin" };

  it("produces a token that verifies successfully", async () => {
    const token = await signToken(payload);
    const result = await verifyToken(token);
    expect(result).not.toBeNull();
    expect(result?.sub).toBe("42");
    expect(result?.username).toBe("alice");
    expect(result?.role).toBe("admin");
  });

  it("returns null for a tampered token", async () => {
    const token = await signToken(payload);
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(await verifyToken(tampered)).toBeNull();
  });

  it("returns null for a completely invalid string", async () => {
    expect(await verifyToken("not.a.jwt")).toBeNull();
  });

  it("returns null for an empty string", async () => {
    expect(await verifyToken("")).toBeNull();
  });

  it("includes all expected payload fields", async () => {
    const token = await signToken({ sub: "1", username: "bob", role: "user" });
    const result = await verifyToken(token);
    expect(result?.sub).toBe("1");
    expect(result?.username).toBe("bob");
    expect(result?.role).toBe("user");
  });

  it("includes ver (token version) in the payload", async () => {
    const token = await signToken({ sub: "1", username: "bob", role: "user", ver: 7 });
    const result = await verifyToken(token);
    expect(result?.ver).toBe(7);
  });
});

describe("getSecret() — production safety", () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  });

  it("refuses to sign when NODE_ENV=production and JWT_SECRET is unset", async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "production";
    await expect(
      signToken({ sub: "1", username: "x", role: "admin" })
    ).rejects.toThrow(/JWT_SECRET must be set/);
  });

  it("refuses to sign when NODE_ENV=production and JWT_SECRET is the default", async () => {
    process.env.JWT_SECRET = "dev-secret-change-me-in-production";
    process.env.NODE_ENV = "production";
    await expect(
      signToken({ sub: "1", username: "x", role: "admin" })
    ).rejects.toThrow(/JWT_SECRET must be set/);
  });

  it("allows the dev default in development", async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "test";
    const token = await signToken({ sub: "1", username: "x", role: "admin" });
    expect(typeof token).toBe("string");
  });
});
