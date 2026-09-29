// Whether an AI model key is set, read from what the `modelReadiness` relay
// answers (`relay/messages.ts`): Core's `secret-keys/snapshot`, each key's
// kind, provider and enabled flag, and never a secret value.
//
// "unknown" is an answer, not a failure: this extension may not have the relay
// yet (`unsupported`), or FluxIQ may not let this browser read its keys. The
// checklist then asks the person to check rather than claiming either way.

import type { PanelResult } from "../../state";
import type { ModelKeyState } from "./setup-steps";

/** The key state a `modelReadiness` reply describes. */
export function modelKeyFromReply(result: PanelResult<unknown>): ModelKeyState {
  if (!result.ok) return "unknown";
  const keys = (result.value as { payload?: { keys?: unknown } } | null)?.payload?.keys;
  if (!Array.isArray(keys)) return "unknown";
  const usable = keys.some((key) => {
    const typed = key as { kind?: unknown; enabled?: unknown } | null;
    return typed?.kind === "llm" && typed.enabled !== false;
  });
  return usable ? "present" : "missing";
}
