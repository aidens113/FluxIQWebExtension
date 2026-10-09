// Whether FluxIQ has a model key it may use, read once when the latest chat
// opens empty, so a person learns before typing a request that FluxIQ cannot
// build yet. It asks the background's `panelModelReadiness` relay, which
// answers `{ ok, payload: { keys: [{ kind?, provider?, enabled }] } }` from
// Core's `secret-keys snapshot` and never a key's value. No DOM.
//
//   ready    at least one key is enabled
//   missing  the relay answered and no key is enabled (none, or all disabled)
//   unknown  the relay failed or answered a shape it does not promise; the
//            chat then says nothing, rather than claim a key is missing

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelStore } from "../../state";

/** What the chat knows about the model keys. */
export type ModelReadiness = "ready" | "missing" | "unknown";

/** Asks the background through `request`; never throws. */
export async function readModelReadiness(request: PanelStore["request"]): Promise<ModelReadiness> {
  try {
    const result = await request<unknown>({ type: RUNTIME_MESSAGES.panelModelReadiness });
    if (!result.ok) return "unknown";
    const keys = record(record(result.value)?.payload)?.keys;
    if (!Array.isArray(keys)) return "unknown";
    return keys.some((key) => record(key)?.enabled === true) ? "ready" : "missing";
  } catch {
    return "unknown";
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
