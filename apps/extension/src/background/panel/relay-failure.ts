// The one way a relay answers that it did not reach Core: a code the panel
// branches on and a sentence it can show as it stands.

import type { PanelRelayFailureCode, PanelRelayResponse } from "../../shared/protocol";

const SENTENCES: Record<Exclude<PanelRelayFailureCode, "unreachable" | "timed_out" | "refused" | "failed" | "not_paired">, string> = {
  forbidden: "Only the FluxIQ panel can do that.",
  no_project: "FluxIQ has not said which project this browser belongs to yet. Connect, then try again.",
  invalid_request: "That request is missing something FluxIQ needs."
};

export function relayFailure(code: keyof typeof SENTENCES, detail?: string): Extract<PanelRelayResponse, { ok: false }> {
  return { ok: false, code, error: detail ?? SENTENCES[code] };
}
