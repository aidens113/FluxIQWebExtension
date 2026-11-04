// The panel's reads and its one write on the project's library of saved parts. Each
// sends Core exactly the fields named here, one by one, and never the panel's
// message spread into the request; Core narrows `save-project-part` to the same five
// fields on its side, so the two checks both hold.
//
// A reply is Core's payload as Core returned it: the cards, the part, the save's
// answer, or `{ refused: true, code, message }` where the library cannot be read.

import { AUTOMATION_PANEL_MESSAGES, type AutomationPanelRequest, type PanelRelayResponse } from "../../shared/protocol";

type Call = (endpoint: string, payload: Record<string, unknown>, programId?: string) => Promise<PanelRelayResponse>;

export function relayPartsRequest(type: string, projectId: string, message: AutomationPanelRequest, call: Call): Promise<PanelRelayResponse> {
  if (type === AUTOMATION_PANEL_MESSAGES.listParts) return call("list-project-parts", listBody(projectId, message));
  if (type === AUTOMATION_PANEL_MESSAGES.getPart) return getPart(projectId, message, call);
  return savePart(projectId, message, call);
}

function getPart(projectId: string, message: AutomationPanelRequest, call: Call): Promise<PanelRelayResponse> {
  const partId = text(message.partId);
  if (!partId) return Promise.resolve(missing("partId"));
  const version = count(message.version);
  return call("get-project-part", { projectId, partId, ...(version !== undefined ? { version } : {}) });
}

function savePart(projectId: string, message: AutomationPanelRequest, call: Call): Promise<PanelRelayResponse> {
  const flowId = text(message.flowId);
  const subflowId = text(message.subflowId);
  const name = text(message.name);
  const purpose = text(message.purpose);
  if (!flowId) return Promise.resolve(missing("flowId"));
  if (!subflowId) return Promise.resolve(missing("subflowId"));
  return call("save-project-part", { projectId, flowId, subflowId, ...(name ? { name } : {}), ...(purpose ? { purpose } : {}) });
}

function listBody(projectId: string, message: AutomationPanelRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { projectId };
  for (const field of ["query", "site", "usedByFlowId", "sourceFlowId"] as const) {
    const value = text(message[field]);
    if (value) body[field] = value;
  }
  for (const field of ["inputName", "outputName", "lasting", "trust"] as const) {
    const value = words(message[field]);
    if (value) body[field] = value;
  }
  const limit = count(message.limit);
  if (limit !== undefined && limit >= 1) body.limit = limit;
  if (typeof message.cursor === "string" && message.cursor) body.cursor = message.cursor;
  return body;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** One word, or a list of them; anything else is not sent. */
function words(value: unknown): string | string[] | undefined {
  if (typeof value === "string") return text(value);
  const list = Array.isArray(value) ? value.map(text).filter((item): item is string => item !== undefined) : [];
  return list.length > 0 ? list : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function missing(name: string): PanelRelayResponse {
  return { ok: false, code: "invalid_request", error: `That request is missing its ${name}.` };
}
