import type { AutomationStudioJudgeEvidenceProjector } from "fluxiq/automation";
import { parseAutomationStudioRecordSchema } from "fluxiq/components/automation";
import type { JsonObject } from "fluxiq/core";
import { webNodeReadResult, webRunnableNode } from "../node-run";
import { isJsonRecord } from "../untrusted-json";
import { webJudgeActionFacts } from "./action";
import { webJudgeReadFacts } from "./read";
import { webJudgeStateValue } from "./state-value";
import { screenedEvidenceUrl } from "../location";
import { present } from "../present";

/** Core's projector result, written key by key so a renamed contract field fails to compile here. */
type WebJudgeProjection = ReturnType<AutomationStudioJudgeEvidenceProjector>;
/** A legacy look's checked semantic state and, when it screens, where it was read. */
type WebJudgeLookFacts = { state: JsonObject; location?: string };

/** Web-owned semantic projection. Raw captures and row copies never enter its durable findings. */
export const projectWebJudgeEvidence: AutomationStudioJudgeEvidenceProjector = (input) => {
  if (!isJsonRecord(input.evidence)) return { role: "observation", missing: ["web_judge.evidence_unrecognized"] };
  const envelope = input.evidence;
  let evidence = isJsonRecord(envelope.evidence) ? envelope.evidence : envelope;
  // The Flow runtime's documented output shape is outputs.result, containing
  // the dispatch's {status,message,result}, with native data under result.
  if (input.source === "flow-attempt" && isJsonRecord(evidence.result)) {
    const dispatched = evidence.result;
    evidence = isJsonRecord(dispatched.result) ? dispatched.result : dispatched;
  }
  if (isJsonRecord(evidence.readPage)) {
    const where = evidence.readPage.where;
    if (typeof where !== "string") return { role: "observation", missing: ["web_judge.read_context_invalid"] };
    const location = screenedEvidenceUrl(where);
    return { role: "observation", evidence: location === undefined ? { captureOmitted: true } : { location } };
  }
  if (isJsonRecord(evidence.legacyLook)) {
    const look = evidence.legacyLook;
    let found: unknown = look.found;
    if (typeof found === "string") {
      try { found = JSON.parse(found) as unknown; } catch { found = undefined; }
    }
    const state = isJsonRecord(found) ? webJudgeStateValue(Object.hasOwn(found, "judgeState") ? found.judgeState : found) : undefined;
    if (state === undefined) return { role: "observation", missing: ["web_judge.look_state_missing"] };
    const location = typeof look.where === "string" ? screenedEvidenceUrl(look.where) : undefined;
    return { role: "observation", evidence: present<WebJudgeLookFacts>({ state, location }) };
  }
  const finding: JsonObject = {};
  const missing: string[] = [];
  const actionRead = webJudgeActionFacts(evidence);
  const action = actionRead.facts;
  if (actionRead.invalid) missing.push("web_judge.action_invalid");
  if (Object.keys(action).length) finding.action = action;
  const source = isJsonRecord(envelope.source) ? pick(envelope.source, ["callId", "nodeId", "attemptId", "step", "pass", "entry"]) : undefined;
  if (source !== undefined && Object.keys(source).length) finding.source = source;
  const rawRead = evidence.read;
  const read = isJsonRecord(rawRead) ? rawRead : evidence;
  const rows = Array.isArray(envelope.records) ? envelope.records : Array.isArray(read.extracted) ? read.extracted : undefined;
  const replayRead = isJsonRecord(evidence.readRows) ? evidence.readRows : undefined;
  const data = rows !== undefined || replayRead !== undefined || rawRead !== undefined;
  if (data) {
    const readFacts = webJudgeReadFacts(read);
    const metadata = readFacts.facts;
    if (readFacts.invalid) missing.push("web_judge.read_invalid");
    if (rows !== undefined) metadata.observedRows = rows.length;
    if (replayRead !== undefined) {
      const reported = webJudgeReadFacts(replayRead);
      metadata.reported = reported.facts;
      if (reported.invalid) missing.push("web_judge.read_invalid");
    }
    if (rawRead !== undefined && !isJsonRecord(rawRead) && !Array.isArray(rawRead)) metadata.value = rawRead;
    // Scalar extraction is a real observed value. List cells stay in the
    // existing validated row/page stores, referenced by the actual source.
    if (read.extracted !== undefined && (read.extracted === null || typeof read.extracted === "string" || typeof read.extracted === "boolean" || typeof read.extracted === "number")) metadata.value = read.extracted;
    if (source === undefined || Object.keys(source).length === 0) missing.push("web_judge.read_source_missing");
    if (Object.hasOwn(envelope, "recordSchema")) {
      const parsed = parseAutomationStudioRecordSchema(envelope.recordSchema);
      if (!parsed.ok) missing.push("web_judge.record_schema_invalid");
      else {
        const fields = parsed.schema.fields.filter((field) => field.handling !== "exclude").map((field) => field.id);
        metadata.fields = fields;
        if (parsed.schema.primaryKey !== undefined) {
          if (parsed.schema.primaryKey.every((field) => fields.includes(field))) metadata.primaryKey = [...parsed.schema.primaryKey];
          else missing.push("web_judge.record_schema_invalid");
        }
      }
    }
    finding.read = metadata;
  }
  // A focused search/description is semantic evidence from its real call,
  // unlike a full page view or an arbitrary raw DOM payload.
  if (typeof evidence.found === "string") finding.found = evidence.found;
  if (isJsonRecord(evidence.element)) finding.element = pick(evidence.element, ["tag", "role", "name", "label", "text", "value", "checked", "selectedValue", "marked", "group", "within"]);
  const after = isJsonRecord(envelope.after) ? envelope.after : undefined;
  const stateHolder = Object.hasOwn(evidence, "judgeState") ? evidence : after;
  const hasState = stateHolder !== undefined && Object.hasOwn(stateHolder, "judgeState");
  const state = hasState ? webJudgeStateValue(stateHolder.judgeState) : undefined;
  if (hasState) {
    const parsed = state;
    if (parsed === undefined) missing.push("web_judge.state_invalid");
    else finding.state = parsed;
  }
  const page = typeof evidence.page === "string" || Array.isArray(evidence.elements) || isJsonRecord(evidence.snapshot);
  const known = data || Object.keys(action).length > 0 || finding.found !== undefined || finding.element !== undefined || hasState;
  if (!known && !page) missing.push("web_judge.evidence_unrecognized");
  if (input.source === "state" && !known && page) missing.push("web_judge.semantic_state_missing");
  if (page) finding.captureOmitted = true;
  // An intentional capture omission is not a required-evidence gap. No
  // succeeded status or empty semantic state is promoted to proof of effect.
  const node = input.definitionId === undefined ? undefined : webRunnableNode(input.definitionId);
  const acted = node?.effect === "mutate" || action.changed !== undefined || action.notice !== undefined || action.effectUncertain !== undefined || action.control !== undefined;
  return present<WebJudgeProjection>({ role: data ? "data" : acted ? "action" : "observation", evidence: webNodeReadResult(finding) ?? {}, missing: missing.length ? missing : undefined });
};

function pick(value: JsonObject, keys: readonly string[]): JsonObject {
  const out: JsonObject = {};
  for (const key of keys) {
    const cell = value[key];
    if (typeof cell === "string" || typeof cell === "boolean" || (typeof cell === "number" && Number.isFinite(cell))) out[key] = cell;
  }
  return out;
}
