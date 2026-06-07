import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  discordProvider,
  discordConfigSchema,
} from "../notifications/providers/discord.js";

let fetchMock: ReturnType<typeof vi.fn>;
const originalFetch = global.fetch;

const WEBHOOK = "https://discord.com/api/webhooks/123456789/abcdefghijklmnop";

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
  // Discord webhook returns 204 No Content on success
  return new Response(null, { status: 204 });
}

function bodyJson(call: unknown[]): Record<string, unknown> {
  const [, init] = call as [string, { body: string }];
  return JSON.parse(init.body);
}

describe("discordConfigSchema", () => {
  it("requires a webhook URL on a Discord host with /api/webhooks/ in the path", () => {
    expect(() => discordConfigSchema.parse({})).toThrow();
    expect(() => discordConfigSchema.parse({ webhookUrl: "" })).toThrow();
    expect(() =>
      discordConfigSchema.parse({ webhookUrl: "https://example.com/api/webhooks/x/y" })
    ).toThrow(/discord\.com/);
    expect(() =>
      discordConfigSchema.parse({ webhookUrl: "https://discord.com/" })
    ).toThrow();
    expect(() =>
      discordConfigSchema.parse({ webhookUrl: "http://discord.com/api/webhooks/x/y" })
    ).toThrow(); // not https
  });

  it("accepts canonical Discord webhook URLs", () => {
    const cfg = discordConfigSchema.parse({ webhookUrl: WEBHOOK });
    expect(cfg.webhookUrl).toBe(WEBHOOK);
    expect(cfg.username).toBeNull();
  });

  it("accepts ptb. and canary. subdomains", () => {
    expect(
      discordConfigSchema.parse({
        webhookUrl: "https://ptb.discord.com/api/webhooks/1/abc",
      }).webhookUrl
    ).toContain("ptb.discord.com");
    expect(
      discordConfigSchema.parse({
        webhookUrl: "https://canary.discord.com/api/webhooks/1/abc",
      }).webhookUrl
    ).toContain("canary.discord.com");
  });

  it("accepts the legacy discordapp.com host", () => {
    expect(
      discordConfigSchema.parse({
        webhookUrl: "https://discordapp.com/api/webhooks/1/abc",
      }).webhookUrl
    ).toContain("discordapp.com");
  });

  it("normalises empty/whitespace username to null and trims set values", () => {
    expect(
      discordConfigSchema.parse({ webhookUrl: WEBHOOK, username: "   " }).username
    ).toBeNull();
    expect(
      discordConfigSchema.parse({ webhookUrl: WEBHOOK, username: " Vehicle Bot " }).username
    ).toBe("Vehicle Bot");
  });
});

describe("discordProvider.send", () => {
  const config = discordConfigSchema.parse({ webhookUrl: WEBHOOK });

  it("POSTs JSON to the webhook URL with an embed", async () => {
    fetchMock.mockResolvedValue(ok());
    await discordProvider.send(config, {
      title: "AB12 CDE — MOT",
      body: "7 days remaining (due 2026-07-01).",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = bodyJson(fetchMock.mock.calls[0]);
    expect(body.username).toBe("Vehicle Dates");
    const embed = (body.embeds as Array<Record<string, unknown>>)[0];
    expect(embed.title).toBe("AB12 CDE — MOT");
    expect(embed.description).toBe("7 days remaining (due 2026-07-01).");
    expect(embed.color).toBe(0x1d4ed8); // default priority
  });

  it("maps priority to a deterministic embed colour", async () => {
    fetchMock.mockResolvedValue(ok());
    const priorities = ["low", "default", "high", "urgent"] as const;
    for (const p of priorities) {
      await discordProvider.send(config, { title: "T", body: "B", priority: p });
    }
    const colours = fetchMock.mock.calls.map(
      (c) => (bodyJson(c).embeds as Array<{ color: number }>)[0].color
    );
    expect(colours).toEqual([0x6b7280, 0x1d4ed8, 0xea580c, 0xdc2626]);
  });

  it("includes the deep-link URL on the embed when set", async () => {
    fetchMock.mockResolvedValue(ok());
    await discordProvider.send(config, {
      title: "T",
      body: "B",
      url: "https://example.com/vehicles/42",
    });
    const embed = (bodyJson(fetchMock.mock.calls[0]).embeds as Array<Record<string, unknown>>)[0];
    expect(embed.url).toBe("https://example.com/vehicles/42");
  });

  it("omits the embed URL when no deep link is supplied", async () => {
    fetchMock.mockResolvedValue(ok());
    await discordProvider.send(config, { title: "T", body: "B" });
    const embed = (bodyJson(fetchMock.mock.calls[0]).embeds as Array<Record<string, unknown>>)[0];
    expect(embed).not.toHaveProperty("url");
  });

  it("uses a custom username when configured", async () => {
    fetchMock.mockResolvedValue(ok());
    const cfg = discordConfigSchema.parse({ webhookUrl: WEBHOOK, username: "Garage Bot" });
    await discordProvider.send(cfg, { title: "T", body: "B" });
    expect(bodyJson(fetchMock.mock.calls[0]).username).toBe("Garage Bot");
  });

  it("surfaces the message field from a Discord error response", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Unknown Webhook", code: 10015 }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );
    await expect(
      discordProvider.send(config, { title: "T", body: "B" })
    ).rejects.toThrow(/Discord returned 404: Unknown Webhook/);
  });

  it("falls back to raw text on a non-JSON error", async () => {
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    await expect(
      discordProvider.send(config, { title: "T", body: "B" })
    ).rejects.toThrow(/Discord returned 429: rate limited/);
  });

  it("propagates network errors", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      discordProvider.send(config, { title: "T", body: "B" })
    ).rejects.toThrow("ECONNRESET");
  });
});
