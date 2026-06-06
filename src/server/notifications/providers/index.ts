import type { ProviderDefinition } from "../types.js";
import { ntfyProvider } from "./ntfy.js";

const REGISTRY: Record<string, ProviderDefinition<unknown>> = {
  [ntfyProvider.type]: ntfyProvider as ProviderDefinition<unknown>,
};

export function getProvider(type: string): ProviderDefinition<unknown> | null {
  return REGISTRY[type] ?? null;
}

export function listProviders(): Array<{ type: string; label: string }> {
  return Object.values(REGISTRY).map((p) => ({ type: p.type, label: p.label }));
}

export { ntfyProvider };
