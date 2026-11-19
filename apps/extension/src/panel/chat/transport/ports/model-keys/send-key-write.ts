// Where a key write is sent: the background relays it to Core as the person's own key (key-backend's
// `modelKeySave`, `modelKeyReplace` and `modelKeyRemove` panel messages; no password or PIN). Core checks a
// saved key with its provider at no cost and answers with the new model-access state, which the card shows.
// The pasted value goes into the one message and nowhere else: no log, no store, no error or answer.
// Until the relay knows these messages it answers with its unknown-message failure, shown as a failed save.

import { readModelAccessState } from "@fluxiq/contracts/platform";
import { modelAccessFromCore, type ModelAccessState, type ModelKeysResult } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../../shared/constants";
import type { PanelStore } from "../../../../state";
import { asRecord, namedFailureOf, refusalOf } from "../../reply";

/** The relay's message types, from the shared `RUNTIME_MESSAGES` (one place for the strings). */
export const KEY_WRITE_MESSAGES = {
  save: RUNTIME_MESSAGES.panelModelKeySave,
  replace: RUNTIME_MESSAGES.panelModelKeyReplace,
  remove: RUNTIME_MESSAGES.panelModelKeyRemove
} as const;

/** One key write: the failure in its own words, or the state Core answered with (absent reads as old FluxIQ). */
export async function sendKeyWrite(request: PanelStore["request"], message: Record<string, unknown> & { type: string }): Promise<ModelKeysResult<{ state: ModelAccessState }>> {
  try {
    const result = await request(message as Parameters<PanelStore["request"]>[0]);
    const failure = namedFailureOf(result) ?? refusalOf(result);
    if (failure && !failure.ok) return { ok: false, message: failure.sentence };
    const payload = result.ok ? asRecord(asRecord(result.value)?.payload) : undefined;
    return { ok: true, state: modelAccessFromCore(readModelAccessState(payload?.modelAccess)) };
  } catch {
    return { ok: false, message: "FluxIQ didn't answer. Try again." };
  }
}
