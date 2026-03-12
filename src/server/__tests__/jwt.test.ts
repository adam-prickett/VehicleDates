import { describe, it, expect } from "vitest";
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
});
