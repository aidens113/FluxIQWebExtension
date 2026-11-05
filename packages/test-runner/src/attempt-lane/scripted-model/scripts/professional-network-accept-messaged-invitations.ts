import type { ScriptedModelRequest } from "../wire-request.js";
import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import { currentPageOf, evidenceOf, latestOf, pageLine, pressOf, toolCall, type EvidenceEntry } from "./evidence.js";

/**
 * `plain`: the Flow's read is the read the model explored with, and its step is the press it made by hand.
 * `reshape`: the Flow's own read is written after the press, under other column names and with a column
 * the first read had not, and its press is written for a row the loop will reach. So the row a pass
 * carries really differs from the row the press was noted on, which is what this form exists to prove.
 */
export type AcceptMessagedForm = "plain" | "reshape";

const ACT = ["modify_existing"];
const READ_NODE = "web.output.dom-extract_list";
const PRESS_NODE = "web.output.dom-click";

type Field = { key: string; sample?: string; label?: string };
type DraftStep = { step: number; actionId: string; disposition?: string; written?: boolean };

const startAttempt: ScriptedReply = (request) => ({ do: "flow.createHere", with: { instruction: request.message } });

/** A finished thought: what the model decides when there is nothing left to call. */
const finish = (summary: string): Record<string, unknown> => ({ kind: "evidence_tool_decision", summary, decision: { kind: "complete", result: { summary } } });

const callsMade = (request: ScriptedModelRequest): ReadonlySet<string> => new Set(evidenceOf(request).map((entry) => entry.callId));

function fieldsOf(structure: EvidenceEntry): readonly Field[] {
  return Array.isArray(structure.value.fields) ? structure.value.fields as readonly Field[] : [];
}

function keyOf(fields: readonly Field[], holds: (field: Field) => boolean, what: string): string {
  const field = fields.find(holds);
  if (!field) throw new Error(`The read's fields hold no ${what}: ${fields.map((candidate) => `${candidate.key}=${candidate.sample ?? candidate.label ?? ""}`).join("; ")}`);
  return field.key;
}

/** A person's name is their row's short text, its message the long line, as the first row shows them: read off the fields, never known ahead. */
const columnsOf = (fields: readonly Field[]) => ({
  name: keyOf(fields, (field) => field.sample === "Ximena Ruiz", "name"),
  message: keyOf(fields, (field) => field.key.endsWith("blockquote") || /^Hi Rafaela/u.test(field.sample ?? ""), "message"),
  headline: keyOf(fields, (field) => /^Senior Recruiter/u.test(field.sample ?? ""), "headline"),
});

/** The Accept inside the row that names `name`, by the page's own lines: a handle read from the page as it stands. */
function acceptOf(page: string, name: string): string {
  const lines = page.split("\n");
  const at = lines.findIndex((line) => line.includes(`"${name} View`));
  if (at < 0) throw new Error(`The page shows no row for ${name}`);
  // The page marks an item's place at its start and again before its controls: its controls end at the next mark.
  const isMark = (line: string) => /^- \d+\/\d+$/u.test(line);
  const after = lines.slice(at + 1);
  const controls = after.slice(after.findIndex(isMark) + 1);
  for (const line of controls) {
    if (isMark(line)) break;
    const accept = /^(t\d+) button "Accept"$/u.exec(line);
    if (accept) return accept[1]!;
  }
  throw new Error(`The row for ${name} shows no Accept`);
}

const readOf = (structure: EvidenceEntry, fields: Record<string, string>, where: readonly Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
  node: READ_NODE,
  parameters: { extractList: { handle: structure.value.extraction, fields, where, minItems: 1 }, ...extra },
  consequences: [],
});

/** The draft the model is shown: which number each of its steps goes by. */
function draftSteps(request: ScriptedModelRequest): readonly DraftStep[] {
  const draft = latestOf(request, "core.flow_draft");
  return Array.isArray(draft?.value.steps) ? draft.value.steps as readonly DraftStep[] : [];
}

function stepOf(request: ScriptedModelRequest, actionId: string): number {
  const proposed = draftSteps(request).filter((step) => step.actionId === actionId && (step.disposition === "kept" || step.disposition === "added" || step.written === true));
  const last = proposed.at(-1);
  if (!last) throw new Error(`The draft holds no kept step of ${actionId}: ${JSON.stringify(draftSteps(request))}`);
  return last.step;
}

/** What stands over the page on a first visit, each only while it shows. */
function clearAndArrive(request: ScriptedModelRequest, page: string): Record<string, unknown> | undefined {
  if (pageLine(page, /"Not now"/u)) return pressOf(request, "Put off the app prompt.", `not-now-${request.ordinal}`, /"Not now"/u);
  if (pageLine(page, /Close your conversation/u)) return pressOf(request, "Close the conversation that opened over the page.", `close-${request.ordinal}`, /Close your conversation/u);
  if (/Cookie Policy|essential and non-essential cookies/u.test(page) && pageLine(page, /button "Accept"$/u)) return pressOf(request, "Accept cookies so the page can be used.", `cookies-${request.ordinal}`, /button "Accept"$/u);
  if (/^URL ~\/mynetwork\/invitation-manager/mu.test(page)) return undefined;
  if (/^URL ~\/mynetwork/mu.test(page)) return pressOf(request, "Open every invitation.", `open-manager-${request.ordinal}`, /link "Show all" ~\/mynetwork\/invitation-manager\/$/u);
  return pressOf(request, "Open my network.", `open-network-${request.ordinal}`, /link .*My Network/u);
}

/** Once the rest are done: see the rows that now say accepted, read them keeping those, and finish. */
function readBack(request: ScriptedModelRequest, page: string): Record<string, unknown> {
  const forward = latestOf(request, "core.run_flow");
  if (forward && forward.value.passed !== true) throw new Error(`The forward run did not pass: ${JSON.stringify(forward.value).slice(0, 1500)}`);
  const made = callsMade(request);
  if (made.has("read-accepted")) return finish("Accepted the three invitations with a message, and listed them.");
  const detected = evidenceOf(request).filter((entry) => entry.toolId === "web.detect_repeating_structure").at(-1);
  if (!made.has("detect-after")) {
    const card = pageLine(page, /"Lucia Romano View/u);
    if (!card) throw new Error("The list does not show Lucia Romano's row after the forward run");
    return toolCall("See the shape of the rows now that some say accepted.", "detect-after", "web.detect_repeating_structure", { target: card.handle });
  }
  const fields = fieldsOf(detected!);
  const name = keyOf(fields, (field) => /^(Ximena Ruiz|Lucia Romano)$/u.test(field.sample ?? ""), "name");
  const message = keyOf(fields, (field) => field.key.endsWith("blockquote"), "message");
  const accepted = keyOf(fields, (field) => field.sample === "Accepted", "accepted mark");
  return toolCall("Read back who now says accepted, with their message.", "read-accepted", "core.run_node", readOf(detected!, { name, message }, [{ field: accepted, contains: "Accepted" }], {
    recordOutput: { datasetId: "accepted", schema: { schemaVersion: "0.1", fields: [{ id: "name", label: "name", valueType: "string" }, { id: "message", label: "message", valueType: "string" }] }, writeMode: "append" },
  }));
}

const decideOf = (form: AcceptMessagedForm): ScriptedReply => (request) => {
  const page = currentPageOf(request);
  const arriving = clearAndArrive(request, page);
  if (arriving) return arriving;
  const made = callsMade(request);
  const structure = evidenceOf(request).find((entry) => entry.toolId === "web.detect_repeating_structure");
  if (!structure) {
    const card = pageLine(page, /"Ximena Ruiz View/u);
    if (!card) throw new Error("The page shows no invitation from Ximena Ruiz");
    return toolCall("See the shape of the invitations.", "detect", "web.detect_repeating_structure", { target: card.handle });
  }
  const columns = columnsOf(fieldsOf(structure));
  const withMessage = [{ field: columns.message, is: "present" }];
  if (!made.has("read-invitations")) return toolCall("Read the invitations, keeping those with a message.", "read-invitations", "core.run_node", readOf(structure, { name: columns.name, message: columns.message }, withMessage), form === "plain");
  if (!made.has("accept-first")) return toolCall("Accept the first invitation that has a message, by hand, to see that it works.", "accept-first", "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: acceptOf(page, "Ximena Ruiz") } }, consequences: ACT }, form === "plain");
  if (form === "reshape" && !made.has("write-read")) return toolCall("Write the Flow's read of the list, with the columns the Flow will carry.", "write-read", "core.run_node", { ...readOf(structure, { person: columns.name, note: columns.message, headline: columns.headline }, withMessage), write: true });
  if (form === "reshape" && !made.has("write-accept")) return toolCall("Write the accept as a step of the Flow, for the rows the repeat reaches.", "write-accept", "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: acceptOf(page, "Lucia Romano") } }, consequences: ACT, write: true });
  if (!made.has("forward") && !repeating(request)) {
    const amendment = { step: stepOf(request, PRESS_NODE), change: "repeat", over: stepOf(request, READ_NODE) };
    return { kind: "evidence_tool_decision", summary: "Repeat the accept over the rows the read keeps.", decision: { kind: "amend_draft", amendments: [amendment] } };
  }
  if (!made.has("forward")) return toolCall("Run forward on the rows not done yet.", "forward", "core.run_flow", { from: stepOf(request, READ_NODE) });
  return readBack(request, page);
};

/** Whether the draft already repeats its press. */
function repeating(request: ScriptedModelRequest): boolean {
  return JSON.stringify(latestOf(request, "core.flow_draft")?.value.steps ?? []).includes("repeats through");
}

/** The judge: yes, on what the person asked for, which Core shows it from its own records. */
const answersRequest: ScriptedReply = () => ({ kind: "diagnosis", diagnosis: { answersRequest: "yes", defects: [] }, summary: "The rows are the people accepted, with their messages." });

/** Enough for every step of its honest path, and few enough that a loop fails it. */
const MOST_DECISIONS = 24;

/** `professional-network-accept-messaged-invitations`, in the form asked for. A wrong form name is refused rather than run as another. */
export function professionalNetworkAcceptMessagedScript(form: string = "plain"): ScriptedModelScript {
  if (form !== "plain" && form !== "reshape") throw new Error(`This script has no form "${form}". It has plain and reshape`);
  const decide = decideOf(form);
  return Object.freeze({
    taskId: "professional-network-accept-messaged-invitations",
    replies: {
      panel_command: [startAttempt],
      evidence_tool_decision: Array.from({ length: MOST_DECISIONS }, () => decide),
      loop_verification: [answersRequest],
    },
  });
}
