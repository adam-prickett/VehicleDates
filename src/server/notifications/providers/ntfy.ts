import { z } from "zod";
import type { ProviderDefinition, Priority } from "../types.js";

export const ntfyConfigSchema = z.object({
  server: z
    .string()
    .url()
    .default("https://ntfy.sh")
    .transform((s) => s.replace(/\/+$/, "")),
  topic: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Topic may only contain letters, numbers, underscore and hyphen"
    ),
  authToken: z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const trimmed = v.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(512).optional().nullable().default(null)
  ),
});

export type NtfyConfig = z.infer<typeof ntfyConfigSchema>;

const PRIORITY_MAP: Record<Priority, string> = {
  low: "2",
  default: "3",
  high: "4",
  urgent: "5",
};

/**
 * ntfy header values must be ASCII per HTTP spec. Strip non-ASCII so a single
 * char in a vehicle's notes (or a UK plate that's been edited) doesn't blow up
 * the whole request. The body is UTF-8 and unaffected.
 */
function asciiHeader(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "?");
}

export const ntfyProvider: ProviderDefinition<NtfyConfig> = {
  type: "ntfy",
  label: "ntfy",
  configSchema: ntfyConfigSchema,
  async send(config, msg) {
    const url = `${config.server}/${encodeURIComponent(config.topic)}`;
    const headers: Record<string, string> = {
      Title: asciiHeader(msg.title),
      Priority: PRIORITY_MAP[msg.priority ?? "default"],
    };
    if (msg.tags && msg.tags.length > 0) {
      headers.Tags = asciiHeader(msg.tags.join(","));
    }
    if (msg.url) {
      headers.Click = msg.url;
    }
    if (config.authToken) {
      headers.Authorization = `Bearer ${config.authToken}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: msg.body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const detail = text ? `: ${text.slice(0, 200)}` : "";
      throw new Error(`ntfy returned ${res.status}${detail}`);
    }
  },
};
