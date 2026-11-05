// The library's port over the panel messages for saved parts: list, get and run. Core's answer comes back as the
// background relays it, `{ ok: true, payload }`. A refusal is an ordinary payload and so a value here, and a failed
// request is a failed `ChatResult`. Nothing throws.

import type { ChatResult, SubflowLibraryPort, SubflowRefusal } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../shared/protocol";
import type { PanelStore } from "../state";
import { readDetail, readListing, readOutcome, readRefusal } from "./read";

const UNREADABLE = "FluxIQ answered in a way this panel could not read.";

/** Sends one message, then reads the payload as a refusal or as what `read` makes of it. */
async function ask<T>(request: PanelStore["request"], message: { type: string } & Record<string, unknown>, read: (payload: unknown) => T | undefined): Promise<ChatResult<T | SubflowRefusal>> {
  const answer = await request<{ payload?: unknown }>(message);
  if (!answer.ok) return answer;
  const payload = answer.value.payload;
  const refusal = readRefusal(payload);
  if (refusal !== undefined) return { ok: true, value: refusal };
  const value = read(payload);
  return value === undefined ? { ok: false, sentence: UNREADABLE } : { ok: true, value };
}

/** The library over the background's parts messages. Only the fields that were given are sent. */
export function createPartsLibraryPort(request: PanelStore["request"]): SubflowLibraryPort {
  return {
    list: ({ projectId, text, limit, cursor }) =>
      ask(request, { type: AUTOMATION_PANEL_MESSAGES.listParts, projectId, ...(text === undefined || text.trim() === "" ? {} : { query: text.trim() }), ...(limit === undefined ? {} : { limit }), ...(cursor ? { cursor } : {}) }, readListing),
    read: ({ projectId, partId, version }) => ask(request, { type: AUTOMATION_PANEL_MESSAGES.getPart, projectId, partId, ...(version === undefined ? {} : { version }) }, readDetail),
    run: ({ projectId, partId, version, inputs, permitted, acknowledgedRepeat }) =>
      ask(
        request,
        {
          type: AUTOMATION_PANEL_MESSAGES.runPart,
          projectId,
          partId,
          inputs: { ...inputs },
          ...(version === undefined ? {} : { version }),
          ...(permitted !== undefined && permitted.length > 0 ? { permittedConsequences: [...permitted] } : {}),
          ...(acknowledgedRepeat === true ? { acknowledgedRepeat: true } : {})
        },
        readOutcome
      )
  };
}
