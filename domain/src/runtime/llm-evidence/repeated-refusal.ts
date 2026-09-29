// Saying so when this domain is about to hand back the answer it already gave.
//
// **The cost of not saying it.** On `run-mulryg6h-ff241a12`, 2026-09-28, three
// of the build's last twelve decisions were `web.output.dom-extract_list`
// answered with 6,149 bytes of evidence that were byte-identical on every one
// of the three, and four more were `web.detect_repeating_structure` answered
// with 206 identical bytes. Seven of the twelve calls that ended the build
// carried no information the model did not already hold, and the model could
// not tell: an answer that repeats looks exactly like a new answer that happens
// to agree. It spent its budget re-asking, the loop exhausted, and no Flow was
// built.
//
// **What this does, and what it deliberately does not.** It compares the
// serialized refusal a call is about to return against the last one this
// project, flow, session and tool produced. When the two are the same bytes it
// says so on the refusal the model reads -- `repeatedAnswer`, counting from 2 --
// and on the trace row a reader of the run sees, as the reason
// `answered_the_same_again`. It does not refuse the call and it does not end
// the loop: ending a build is Core's own no-progress guard's job, and a domain
// that declined to answer would be refusing the automation's own work. What it
// removes is the silence that made the repetition invisible to both readers.
//
// **The reason is swapped, not added, on a repeat.** A trace row carries one
// `resultReason` and Core's step record carries no room for a second
// (`AS/runtime/flow-bootstrap/evidence-loop-steps.ts`). The cause is not lost:
// the first of a run of identical refusals carries it, every repeat says it is
// a repeat of that, and the full reason stays inside the packet's own `detail`
// where the model reads it.
//
// **A success clears the run.** Two identical refusals with a working call
// between them are still two identical refusals, but the page they describe has
// moved on, so the count starts again rather than accumulating across a build
// that is making progress.

import type { JsonValue } from "fluxiq/core";
import type { WebLlmEvidenceToolExecution } from "./capture";
import {
  rejectionDetail,
  WEB_LLM_TOOL_RESULT_SCHEMA_VERSION,
  type WebLlmToolRejection,
  type WebLlmToolRejectionDetail
} from "./tool-rejection";

/**
 * How many (project, flow, session, tool) slots are remembered at once.
 *
 * Small on purpose: this compares one answer with the one before it, so a slot
 * holds a single serialization and the oldest is let go. A build that has moved
 * on to another flow has nothing to repeat.
 */
const REMEMBERED_ANSWERS = 16;

export type WebLlmRepeatedRefusals = {
  /**
   * The call's own answer, with the fact that it repeats written on it when it
   * does. Returned unchanged the first time, and for every answer that is not a
   * refusal.
   */
  answered(key: string, answer: WebLlmEvidenceToolExecution): WebLlmEvidenceToolExecution;
};

export function createWebLlmRepeatedRefusals(): WebLlmRepeatedRefusals {
  const given = new Map<string, { said: string; times: number }>();
  return {
    answered(key, answer) {
      const packet = refusalPacket(answer.evidence);
      if (packet === undefined) {
        // Not a refusal: whatever the call did, it did something, and the next
        // refusal is the first of its run rather than the next of the last.
        given.delete(key);
        return answer;
      }
      const said = JSON.stringify(answer.evidence);
      const before = given.get(key);
      const times = before?.said === said ? before.times + 1 : 1;
      remember(given, key, { said, times });
      if (times < 2) return answer;
      // Written onto the packet this call just built rather than rebuilt around
      // it. Nothing else holds a reference to it, and rebuilding would mean
      // restating every member of a result Core reads against an exact key list
      // -- one member too many there is the whole call refused
      // (`capture.ts`, WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS).
      packet.detail = repeatedRejectionDetail(packet.detail, times);
      answer.resultReason = "answered_the_same_again";
      answer.repeatedAnswer = times;
      return answer;
    }
  };
}

/**
 * The same refusal, said again, with how many times in a row it has now been
 * the answer.
 *
 * Every member is restated by name rather than spread, which is the rule for
 * every value this directory puts on the wire (`./present.ts`): a field added
 * to the detail and forgotten here would be dropped from exactly the refusals
 * that matter most, and only on the repeat, which is the hardest place to
 * notice it.
 */
export function repeatedRejectionDetail(detail: WebLlmToolRejectionDetail | undefined, repeatedAnswer: number): WebLlmToolRejectionDetail {
  return rejectionDetail({
    reason: detail?.reason ?? "answered_the_same_again",
    target: detail?.target,
    instead: detail?.instead,
    missing: detail?.missing,
    requestId: detail?.requestId,
    startLocation: detail?.startLocation,
    groupsSeen: detail?.groupsSeen,
    rowsSeen: detail?.rowsSeen,
    controlsSeen: detail?.controlsSeen,
    recordsRead: detail?.recordsRead,
    itemsSeen: detail?.itemsSeen,
    emptyRecords: detail?.emptyRecords,
    missingFields: detail?.missingFields,
    waitStoppedOn: detail?.waitStoppedOn,
    paginationStop: detail?.paginationStop,
    repeatedAnswer
  });
}

/**
 * The refusal a call is answering with, or nothing for an answer that is not
 * one.
 *
 * Judged on the packet's own two declared facts rather than on what built it: a
 * success carries its own schema version, so neither a page packet nor a
 * structure packet can be mistaken for a refusal.
 */
function refusalPacket(evidence: JsonValue): WebLlmToolRejection | undefined {
  if (evidence === null || typeof evidence !== "object" || Array.isArray(evidence)) return undefined;
  const packet = evidence as unknown as WebLlmToolRejection;
  return packet.schemaVersion === WEB_LLM_TOOL_RESULT_SCHEMA_VERSION && packet.ok === false ? packet : undefined;
}

/** Keep this slot as the newest entry, and let the oldest go past the bound. */
function remember(given: Map<string, { said: string; times: number }>, key: string, answer: { said: string; times: number }): void {
  given.delete(key);
  given.set(key, answer);
  for (const oldest of given.keys()) {
    if (given.size <= REMEMBERED_ANSWERS) break;
    given.delete(oldest);
  }
}
