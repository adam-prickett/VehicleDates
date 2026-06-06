import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ntfyProvider, ntfyConfigSchema } from "../notifications/providers/ntfy.js";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  // @ts-expect-error overriding global fetch for tests
  global.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function ok() {
  return Promise.resolve(new Response("", { status: 200 }));
}

describe("ntfyConfigSchema", () => {
  it("defaults the server to https://ntfy.sh and strips trailing slashes", () => {
    expect(ntfyConfigSchema.parse({ topic: "abc" }).server).toBe("https://ntfy.sh");
    expect(ntfyConfigSchema.parse({ server: "https://example.com/", topic: "abc" }).server).toBe(
      "https://example.com"
    );
  });

  it("rejects topics with disallowed characters", () => {
    expect(() => ntfyConfigSchema.parse({ topic: "has space" })).toThrow();
    expect(() => ntfyConfigSchema.parse({ topic: "weird/slash" })).toThrow();
    expect(() => ntfyConfigSchema.parse({ topic: "" })).toThrow();
  });

  it("accepts valid topics", () => {
    expect(ntfyConfigSchema.parse({ topic: "my_topic-1" }).topic).toBe("my_topic-1");
  });

  it("normalises empty/missing authToken to null", () => {
    expect(ntfyConfigSchema.parse({ topic: "abc" }).authToken).toBeNull();
    expect(ntfyConfigSchema.parse({ topic: "abc", authToken: "" }).authToken).toBeNull();
    expect(ntfyConfigSchema.parse({ topic: "abc", authToken: "tk_x" }).authToken).toBe("tk_x");
  });
});

describe("ntfyProvider.send", () => {
  const config = ntfyConfigSchema.parse({ topic: "vehicle-alerts" });

  it("POSTs to <server>/<topic> with the body, Title and Priority headers", async () => {
    fetchMock.mockResolvedValue(ok());

    await ntfyProvider.send(config, {
      title: "MOT due soon",
      body: "AB12 CDE — 7 days remaining",
      priority: "high",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ntfy.sh/vehicle-alerts");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("AB12 CDE — 7 days remaining");
    expect(init.headers.Title).toBe("MOT due soon");
    expect(init.headers.Priority).toBe("4");
  });

  it("maps each priority to ntfy's numeric scale", async () => {
    fetchMock.mockResolvedValue(ok());
    const calls = ["low", "default", "high", "urgent"] as const;
    for (const p of calls) {
      await ntfyProvider.send(config, { title: "x", body: "y", priority: p });
    }
    const priorities = fetchMock.mock.calls.map((c) => c[1].headers.Priority);
    expect(priorities).toEqual(["2", "3", "4", "5"]);
  });

  it("defaults priority to 3 (default) when omitted", async () => {
    fetchMock.mockResolvedValue(ok());
    await ntfyProvider.send(config, { title: "x", body: "y" });
    expect(fetchMock.mock.calls[0][1].headers.Priority).toBe("3");
  });

  it("includes Tags and Click headers when provided", async () => {
    fetchMock.mockResolvedValue(ok());
    await ntfyProvider.send(config, {
      title: "x",
      body: "y",
      tags: ["car", "warning"],
      url: "https://example.com/vehicles/42",
    });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Tags).toBe("car,warning");
    expect(headers.Click).toBe("https://example.com/vehicles/42");
  });

  it("includes Authorization: Bearer when authToken is configured", async () => {
    fetchMock.mockResolvedValue(ok());
    const cfg = ntfyConfigSchema.parse({ topic: "abc", authToken: "tk_secret" });
    await ntfyProvider.send(cfg, { title: "x", body: "y" });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tk_secret");
  });

  it("omits Authorization when no authToken is set", async () => {
    fetchMock.mockResolvedValue(ok());
    await ntfyProvider.send(config, { title: "x", body: "y" });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("strips non-ASCII bytes from header values to satisfy HTTP", async () => {
    fetchMock.mockResolvedValue(ok());
    await ntfyProvider.send(config, { title: "café — naïve", body: "café — naïve" });
    expect(fetchMock.mock.calls[0][1].headers.Title).toBe("caf? ? na?ve");
    // Body is UTF-8 and untouched
    expect(fetchMock.mock.calls[0][1].body).toBe("café — naïve");
  });

  it("URL-encodes the topic so reserved characters can't break the URL", async () => {
    fetchMock.mockResolvedValue(ok());
    // Topic regex would reject these in real use, but the encoder is defensive
    await ntfyProvider.send({ ...config, topic: "weird thing" } as never, {
      title: "x",
      body: "y",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://ntfy.sh/weird%20thing");
  });

  it("throws with the response status when ntfy returns non-2xx", async () => {
    fetchMock.mockResolvedValue(
      new Response("topic does not exist", { status: 404 })
    );
    await expect(
      ntfyProvider.send(config, { title: "x", body: "y" })
    ).rejects.toThrow(/ntfy returned 404/);
  });

  it("propagates network errors", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(
      ntfyProvider.send(config, { title: "x", body: "y" })
    ).rejects.toThrow("ECONNREFUSED");
  });
});
