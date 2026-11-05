// The library's port over the panel messages for saved parts: list, get, save and run. Core's answer comes back as the
// background relays it, `{ ok: true, payload }`. A refusal is an ordinary payload and so a value here, and a failed
// request is a failed `ChatResult`. Nothing throws.

import type { ChatResult, SubflowLibraryPort, SubflowReading, SubflowRefusal } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../shared/protocol";
import type { PanelStore } from "../state";
import { nameCallers, readDetail, readFlowNames, readListing, readOutcome, readRefusal, readSave } from "./read";

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

/** Names the automations that use a subflow, from the automations list. A list that cannot be read leaves them unnamed: the detail still shows. */
async function withFlowNames(request: PanelStore["request"], answer: ChatResult<SubflowReading | SubflowRefusal>): Promise<ChatResult<SubflowReading | SubflowRefusal>> {
  if (!answer.ok || answer.value.refused || !answer.value.detail.callers.some((caller) => caller.kind === "flow" && caller.flowId !== undefined)) return answer;
  const listed = await request<{ payload?: unknown }>({ type: AUTOMATION_PANEL_MESSAGES.listAutomations });
  if (!listed.ok) return answer;
  return { ok: true, value: { ...answer.value, detail: nameCallers(answer.value.detail, readFlowNames(listed.value.payload)) } };
}

/** The library over the background's parts messages. Only the fields that were given are sent. */
export function createPartsLibraryPort(request: PanelStore["request"]): SubflowLibraryPort {
  return {
    list: ({ projectId, text, limit, cursor }) =>
      ask(request, { type: AUTOMATION_PANEL_MESSAGES.listParts, projectId, ...(text === undefined || text.trim() === "" ? {} : { query: text.trim() }), ...(limit === undefined ? {} : { limit }), ...(cursor ? { cursor } : {}) }, readListing),
    read: async ({ projectId, partId, version }) =>
      withFlowNames(request, await ask(request, { type: AUTOMATION_PANEL_MESSAGES.getPart, projectId, partId, ...(version === undefined ? {} : { version }) }, readDetail)),
    save: ({ projectId, flowId, subflowId, name, purpose }) =>
      ask(
        request,
        { type: AUTOMATION_PANEL_MESSAGES.savePart, projectId, flowId, subflowId, ...(name === undefined || name.trim() === "" ? {} : { name: name.trim() }), ...(purpose === undefined || purpose.trim() === "" ? {} : { purpose: purpose.trim() }) },
        readSave
      ),
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
