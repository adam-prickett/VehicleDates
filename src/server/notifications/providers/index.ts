import type { FieldSpec, ProviderDefinition } from "../types.js";
import { ntfyProvider } from "./ntfy.js";
import { pushoverProvider } from "./pushover.js";

const REGISTRY: Record<string, ProviderDefinition<unknown>> = {
  [ntfyProvider.type]: ntfyProvider as ProviderDefinition<unknown>,
  [pushoverProvider.type]: pushoverProvider as ProviderDefinition<unknown>,
};

export interface ProviderInfo {
  type: string;
  label: string;
  description?: string;
  fields: FieldSpec[];
}

export function getProvider(type: string): ProviderDefinition<unknown> | null {
  return REGISTRY[type] ?? null;
}

export function listProviders(): ProviderInfo[] {
  return Object.values(REGISTRY).map((p) => ({
    type: p.type,
    label: p.label,
    description: p.description,
    fields: p.fields,
  }));
}

export { ntfyProvider, pushoverProvider };
