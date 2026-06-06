import type { z } from "zod";

export type Priority = "low" | "default" | "high" | "urgent";

export interface NotificationMessage {
  title: string;
  body: string;
  priority?: Priority;
  url?: string;
  tags?: string[];
}

export interface ProviderDefinition<TConfig = unknown> {
  /** Stable identifier persisted in notification_channels.type */
  type: string;
  /** User-facing label */
  label: string;
  /**
   * Zod schema validating the JSON config blob on save. Input is `unknown`
   * (whatever the client sent / what's in the DB); output is the parsed and
   * normalised config consumed by `send`.
   */
  configSchema: z.ZodType<TConfig, z.ZodTypeDef, unknown>;
  /** Dispatch one message via this provider. Throws on failure. */
  send(config: TConfig, msg: NotificationMessage): Promise<void>;
}
