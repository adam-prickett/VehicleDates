import { z } from "zod";
import type { ProviderDefinition, Priority } from "../types.js";

export const pushoverConfigSchema = z.object({
  userKey: z.string().min(1).max(64),
  appToken: z.string().min(1).max(64),
  device: z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t.length === 0 ? undefined : t;
    },
    z.string().max(64).optional().nullable().default(null)
  ),
  sound: z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t.length === 0 ? undefined : t;
    },
    z.string().max(32).optional().nullable().default(null)
  ),
});

export type PushoverConfig = z.infer<typeof pushoverConfigSchema>;

const PUSHOVER_ENDPOINT = "https://api.pushover.net/1/messages.json";

// Pushover priority is -2..2. We cap at 1 because priority 2 (emergency)
// requires `retry` and `expire` params we don't currently expose; sending
// priority=2 without them returns an error.
const PRIORITY_MAP: Record<Priority, string> = {
  low: "-1",
  default: "0",
  high: "1",
  urgent: "1",
};

interface PushoverErrorBody {
  errors?: string[];
  message?: string;
}

interface PushoverSuccessBody {
  status?: number;
  /**
   * Pushover sets `info` even on 200 responses when something noteworthy
   * happened — most commonly "no active devices to send to" when the user
   * key is valid but the account has no devices subscribed. We treat any
   * `info` value as a failure so the user finds out.
   */
  info?: string;
}

export const pushoverProvider: ProviderDefinition<PushoverConfig> = {
  type: "pushover",
  label: "Pushover",
  description:
    "Push to the Pushover mobile and desktop apps. Needs your User Key and an Application API token.",
  fields: [
    {
      name: "userKey",
      label: "User key",
      type: "text",
      required: true,
      placeholder: "Your Pushover user/group key",
      help: "Shown on your Pushover dashboard. Looks like a 30-character random string.",
    },
    {
      name: "appToken",
      label: "Application token",
      type: "password",
      required: true,
      placeholder: "API token for an application you create",
      help: "Create an application at pushover.net/apps/build and paste its API token here.",
    },
    {
      name: "device",
      label: "Device (optional)",
      type: "text",
      placeholder: "e.g. iphone — leave blank to send to all",
    },
    {
      name: "sound",
      label: "Sound (optional)",
      type: "text",
      placeholder: "e.g. bugle, magic, none",
      help: "Sound names listed at pushover.net/api#sounds.",
    },
  ],
  configSchema: pushoverConfigSchema,
  async send(config, msg) {
    const params = new URLSearchParams({
      token: config.appToken,
      user: config.userKey,
      title: msg.title,
      message: msg.body,
      priority: PRIORITY_MAP[msg.priority ?? "default"],
    });
    if (msg.url) {
      params.set("url", msg.url);
      params.set("url_title", "View vehicle");
    }
    if (config.device) params.set("device", config.device);
    if (config.sound) params.set("sound", config.sound);

    const res = await fetch(PUSHOVER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      let detail = "";
      if (text) {
        try {
          const body = JSON.parse(text) as PushoverErrorBody;
          if (Array.isArray(body.errors) && body.errors.length > 0) {
            detail = `: ${body.errors.join(", ")}`;
          } else if (body.message) {
            detail = `: ${body.message}`;
          } else {
            detail = `: ${text.slice(0, 200)}`;
          }
        } catch {
          detail = `: ${text.slice(0, 200)}`;
        }
      }
      throw new Error(`Pushover returned ${res.status}${detail}`);
    }

    // 200 OK doesn't always mean "delivered". Pushover signals soft failures
    // like "no active devices to send to" or "device not found" via an `info`
    // field in the response body; treat any `info` value as a delivery
    // failure so the caller (and the user via the activity log / test
    // button) actually finds out.
    if (text) {
      try {
        const body = JSON.parse(text) as PushoverSuccessBody;
        if (body.info && body.info.trim().length > 0) {
          throw new Error(`Pushover delivery warning: ${body.info}`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Pushover delivery warning:")) {
          throw err;
        }
        // JSON parse failure on a 200 response is unusual but not actionable.
      }
    }
  },
};
