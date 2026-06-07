import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  pushoverProvider,
  pushoverConfigSchema,
} from "../notifications/providers/pushover.js";

let fetchMock: ReturnType<typeof vi.fn>;
const originalFetch = global.fetch;

beforeEach(() => {
  fetchMock = vi.fn();
  // @ts-expect-error overriding global fetch for tests
  global.fetch = fetchMock;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function ok() {
  return new Response(JSON.stringify({ status: 1, request: "abc" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function bodyParams(call: unknown[]): URLSearchParams {
  const [, init] = call as [string, { body: string }];
  return new URLSearchParams(init.body);
}

describe("pushoverConfigSchema", () => {
  it("requires userKey and appToken", () => {
    expect(() => pushoverConfigSchema.parse({})).toThrow();
    expect(() => pushoverConfigSchema.parse({ userKey: "u" })).toThrow();
    expect(() => pushoverConfigSchema.parse({ appToken: "t" })).toThrow();
  });

  it("accepts the minimum config", () => {
    const cfg = pushoverConfigSchema.parse({ userKey: "u", appToken: "t" });
    expect(cfg).toEqual({ userKey: "u", appToken: "t", device: null, sound: null });
  });

  it("normalises empty/whitespace device and sound to null", () => {
    expect(
      pushoverConfigSchema.parse({ userKey: "u", appToken: "t", device: "  ", sound: "" }).device
    ).toBeNull();
    expect(
      pushoverConfigSchema.parse({ userKey: "u", appToken: "t", device: "  ", sound: "" }).sound
    ).toBeNull();
  });

  it("trims surrounding whitespace from device and sound", () => {
    const cfg = pushoverConfigSchema.parse({
      userKey: "u",
      appToken: "t",
      device: " phone ",
      sound: " bugle ",
    });
    expect(cfg.device).toBe("phone");
    expect(cfg.sound).toBe("bugle");
  });
});

describe("pushoverProvider.send", () => {
  const config = pushoverConfigSchema.parse({
    userKey: "USER_KEY",
    appToken: "APP_TOKEN",
  });

  it("POSTs form-encoded to the Pushover messages endpoint", async () => {
    fetchMock.mockResolvedValue(ok());
    await pushoverProvider.send(config, { title: "T", body: "B" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.pushover.net/1/messages.json");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const params = bodyParams(fetchMock.mock.calls[0]);
    expect(params.get("token")).toBe("APP_TOKEN");
    expect(params.get("user")).toBe("USER_KEY");
    expect(params.get("title")).toBe("T");
    expect(params.get("message")).toBe("B");
    expect(params.get("priority")).toBe("0");
  });

  it("maps each priority to Pushover's -1..1 scale, capping at 1", async () => {
    fetchMock.mockResolvedValue(ok());
    const priorities = ["low", "default", "high", "urgent"] as const;
    for (const p of priorities) {
      await pushoverProvider.send(config, { title: "T", body: "B", priority: p });
    }
    const values = fetchMock.mock.calls.map((c) => bodyParams(c).get("priority"));
    expect(values).toEqual(["-1", "0", "1", "1"]);
  });

  it("defaults priority to 0 when omitted", async () => {
    fetchMock.mockResolvedValue(ok());
    await pushoverProvider.send(config, { title: "T", body: "B" });
    expect(bodyParams(fetchMock.mock.calls[0]).get("priority")).toBe("0");
  });

  it("includes a deep link with a 'View vehicle' url_title when url is set", async () => {
    fetchMock.mockResolvedValue(ok());
    await pushoverProvider.send(config, {
      title: "T",
      body: "B",
      url: "https://example.com/vehicles/42",
    });
    const params = bodyParams(fetchMock.mock.calls[0]);
    expect(params.get("url")).toBe("https://example.com/vehicles/42");
    expect(params.get("url_title")).toBe("View vehicle");
  });

  it("omits url and url_title when no url is supplied", async () => {
    fetchMock.mockResolvedValue(ok());
    await pushoverProvider.send(config, { title: "T", body: "B" });
    const params = bodyParams(fetchMock.mock.calls[0]);
    expect(params.has("url")).toBe(false);
    expect(params.has("url_title")).toBe(false);
  });

  it("forwards optional device and sound from config", async () => {
    fetchMock.mockResolvedValue(ok());
    const cfg = pushoverConfigSchema.parse({
      userKey: "U",
      appToken: "T",
      device: "iphone",
      sound: "bugle",
    });
    await pushoverProvider.send(cfg, { title: "T", body: "B" });
    const params = bodyParams(fetchMock.mock.calls[0]);
    expect(params.get("device")).toBe("iphone");
    expect(params.get("sound")).toBe("bugle");
  });

  it("omits device and sound when not set", async () => {
    fetchMock.mockResolvedValue(ok());
    await pushoverProvider.send(config, { title: "T", body: "B" });
    const params = bodyParams(fetchMock.mock.calls[0]);
    expect(params.has("device")).toBe(false);
    expect(params.has("sound")).toBe(false);
  });

  it("surfaces the errors[] array from a Pushover error response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 0,
          errors: ["application token is invalid", "user identifier is invalid"],
          request: "x",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(
      pushoverProvider.send(config, { title: "T", body: "B" })
    ).rejects.toThrow(
      /Pushover returned 400: application token is invalid, user identifier is invalid/
    );
  });

  it("falls back to plain-text body when the error response isn't JSON", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(
      pushoverProvider.send(config, { title: "T", body: "B" })
    ).rejects.toThrow(/Pushover returned 500: nope/);
  });

  it("propagates network errors", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      pushoverProvider.send(config, { title: "T", body: "B" })
    ).rejects.toThrow("ECONNRESET");
  });
});
