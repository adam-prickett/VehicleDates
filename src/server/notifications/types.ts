import type { z } from "zod";

export type Priority = "low" | "default" | "high" | "urgent";

export interface NotificationMessage {
  title: string;
  body: string;
  priority?: Priority;
  url?: string;
  tags?: string[];
}

/**
 * Input type for a single config field as rendered by the client modal. Maps
 * to the HTML `type` attribute (so iOS picks the right keyboard / masks
 * secrets). `password` purely affects rendering — secret storage is a
 * separate concern (see BACKLOG).
 */
export type FieldInputType = "text" | "password" | "url";

export interface FieldSpec {
  /** Matches the corresponding key in the provider's Zod schema. */
  name: string;
  /** User-facing label. */
  label: string;
  type: FieldInputType;
  /** When true, the modal disables Save until the field has a value. */
  required?: boolean;
  placeholder?: string;
  /** Small grey help text shown beneath the input. */
  help?: string;
  /** Initial value when adding a new channel of this provider type. */
  defaultValue?: string;
}

export interface ProviderDefinition<TConfig = unknown> {
  /** Stable identifier persisted in notification_channels.type */
  type: string;
  /** User-facing label */
  label: string;
  /** Optional one-line blurb shown at the top of the modal. */
  description?: string;
  /** Ordered list of UI fields the channel modal renders. */
  fields: FieldSpec[];
  /**
   * Zod schema validating the JSON config blob on save. Input is `unknown`
   * (whatever the client sent / what's in the DB); output is the parsed and
   * normalised config consumed by `send`.
   */
  configSchema: z.ZodType<TConfig, z.ZodTypeDef, unknown>;
  /** Dispatch one message via this provider. Throws on failure. */
  send(config: TConfig, msg: NotificationMessage): Promise<void>;
}
