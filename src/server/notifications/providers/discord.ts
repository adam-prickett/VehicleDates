import { z } from "zod";
import type { ProviderDefinition, Priority } from "../types.js";

function isDiscordWebhookUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    const isDiscordHost =
      host === "discord.com" ||
      host.endsWith(".discord.com") ||
      host === "discordapp.com" ||
      host.endsWith(".discordapp.com");
    if (!isDiscordHost) return false;
    // Discord webhook URLs look like /api/webhooks/<id>/<token>
    return u.pathname.includes("/api/webhooks/");
  } catch {
    return false;
  }
}

export const discordConfigSchema = z.object({
  webhookUrl: z
    .string()
    .min(1)
    .refine(isDiscordWebhookUrl, {
      message: "Must be an https://discord.com/api/webhooks/… URL",
    }),
  username: z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t.length === 0 ? undefined : t;
    },
    z.string().max(80).optional().nullable().default(null)
  ),
});

export type DiscordConfig = z.infer<typeof discordConfigSchema>;

// Embed border colour by message priority. Picked to match the app's existing
// blue / amber / red status palette so the colour cue carries between the
// dashboard alerts and Discord.
const PRIORITY_COLOUR: Record<Priority, number> = {
  low: 0x6b7280, // gray-500
  default: 0x1d4ed8, // blue-700 (matches app theme)
  high: 0xea580c, // orange-600
  urgent: 0xdc2626, // red-600
};

interface DiscordErrorBody {
  message?: string;
  code?: number;
}

export const discordProvider: ProviderDefinition<DiscordConfig> = {
  type: "discord",
  label: "Discord",
  description:
    "Post into a Discord channel via an incoming webhook. The webhook URL contains a secret token — anyone with it can post to your channel.",
  fields: [
    {
      name: "webhookUrl",
      label: "Webhook URL",
      type: "password",
      required: true,
      placeholder: "https://discord.com/api/webhooks/…",
      help: "Channel settings → Integrations → Webhooks → Copy Webhook URL.",
    },
    {
      name: "username",
      label: "Bot username (optional)",
      type: "text",
      placeholder: "Vehicle Dates",
      help: "Overrides the name the webhook posts under.",
    },
  ],
  configSchema: discordConfigSchema,
  async send(config, msg) {
    const embed: Record<string, unknown> = {
      title: msg.title,
      description: msg.body,
      color: PRIORITY_COLOUR[msg.priority ?? "default"],
    };
    if (msg.url) embed.url = msg.url;

    const body: Record<string, unknown> = {
      username: config.username ?? "Vehicle Dates",
      embeds: [embed],
    };

    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = "";
      if (text) {
        try {
          const parsed = JSON.parse(text) as DiscordErrorBody;
          detail = parsed.message ? `: ${parsed.message}` : `: ${text.slice(0, 200)}`;
        } catch {
          detail = `: ${text.slice(0, 200)}`;
        }
      }
      throw new Error(`Discord returned ${res.status}${detail}`);
    }
  },
};
