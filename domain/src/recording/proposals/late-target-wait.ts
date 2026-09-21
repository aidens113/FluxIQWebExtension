// A wait before a click whose target a DOM addition produced (W25, option 2 of
// `i-late-target-wait`).
//
// The recorder sends its pending mutation batch before any event that can be
// executable, so a DOM addition made before a click is recorded before it. Core
// hands a recording mapper that batch as an `input.event` observation whose
// payload is `{ latestEvidence }`, together with the entries after it
// (`following`). When the next executable entry is a click on a CSS selector in
// the same document, the mutation's own call proposes waiting for that selector
// to be present, so a replay that reaches the click before the page has added
// its target waits rather than failing to find it.
//
// The wait is proposed from the mutation's call, never from the click's: a
// candidate returned for a click's `action` entry replaces Core's fallback click.
// It carries no `timeoutMs` in its parameters: a replay waits as long as its Flow
// node's timeout, 5,000 ms unless the node sets one, which the runtime adapter
// sends the client as the command's timeout. It carries no `sourceInputIds` or
// `expectedConfirmation` either: Core refuses a source input that is not
// action-role, and a wait has no echo to confirm.

import type { AutomationStudioRecordingMapperCandidate } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webAutomationRecordedAction } from "../../io/input-model";

/** A recorded entry as the mapper reads it: nested event type and payload already unwrapped, metadata merged. */
type RecordedStep = { eventType: string; timestamp: number; payload: JsonObject; metadata: JsonObject };

/** The observation type Core gives an event-role input, which is how recording evidence reaches the mapper. */
const EVIDENCE_OBSERVATION = "input.event";
/** The entry type Core gives an action-role input that resolved to an output. */
const ACTION_ENTRY = "action";
const MUTATION_KIND = "dom.mutation";
const CLICK_OUTPUT = "web.dom.click";
const WAIT_OUTPUT = "web.dom.wait_for_selector";
const TOP_FRAME_ID = 0;

/**
 * The wait a recorded DOM addition proposes, or `undefined` when it proposes
 * none.
 *
 * `step` must be a mutation batch that added at least one node. The first
 * executable entry in `following` decides: an `action` entry by its `outputId`,
 * any other entry by the domain's one recorded-event mapping. Evidence before it
 * is skipped. The wait is proposed only when that entry is a `web.dom.click`
 * with a selector, in the same document:
 *
 * - The click replays in the top document. The wait names no frame, so it runs
 *   there; a click recorded in a child frame proposes nothing.
 * - The click's target sits in the document itself. A target recorded inside a
 *   shadow root has a selector written within that root, and a wait names no
 *   root, so it would look for that selector in the light document -- where it
 *   names something else or nothing -- and a click recorded inside one proposes
 *   nothing.
 * - The click's own URL, when it carries one, is the mutation's URL apart from
 *   the fragment. An `action` entry carries none.
 * - No evidence skipped on the way names another URL, which would mean the page
 *   changed between the addition and the click.
 */
export function webAutomationLateTargetWait(step: RecordedStep, following: readonly RecordedStep[]): AutomationStudioRecordingMapperCandidate | undefined {
  const document = addedNodesDocument(step);
  if (document === undefined) return undefined;
  for (const next of following) {
    const action = executableAction(next);
    if (action === undefined) {
      if (namesAnotherDocument(next, document)) return undefined;
      continue;
    }
    return clickTargetWait(action, next, document);
  }
  return undefined;
}

/** The document a mutation batch that added nodes happened in, as its URL without the fragment. */
function addedNodesDocument(step: RecordedStep): string | undefined {
  if (step.eventType !== EVIDENCE_OBSERVATION) return undefined;
  const evidence = objectValue(step.payload.latestEvidence);
  if (evidence?.kind !== MUTATION_KIND) return undefined;
  const added = objectValue(evidence.mutation)?.added;
  return typeof added === "number" && added > 0 ? documentKey(evidence.url) : undefined;
}

function executableAction(step: RecordedStep): { outputId: string; parameters: JsonObject } | undefined {
  if (step.eventType === ACTION_ENTRY) {
    const outputId = stringValue(step.payload.outputId) ?? stringValue(step.payload.actionType);
    return outputId === undefined ? undefined : { outputId, parameters: objectValue(step.payload.parameters) ?? {} };
  }
  return webAutomationRecordedAction(step.eventType, step.payload, step.metadata);
}

function clickTargetWait(action: { outputId: string; parameters: JsonObject }, step: RecordedStep, document: string): AutomationStudioRecordingMapperCandidate | undefined {
  if (action.outputId !== CLICK_OUTPUT) return undefined;
  const selector = stringValue(action.parameters.selector);
  if (selector === undefined || selector.length === 0) return undefined;
  const frameId = action.parameters.browserFrameId;
  if (frameId !== undefined && frameId !== TOP_FRAME_ID) return undefined;
  if (insideShadowRoot(action.parameters)) return undefined;
  if (step.payload.url !== undefined && documentKey(step.payload.url) !== document) return undefined;
  return { outputId: WAIT_OUTPUT, parameters: { selector, wait: { condition: "present" } }, confidence: 0.9, label: "Wait for element" };
}

/** Whether the click's recorded element carries a shadow host chain, so its selector is written within a shadow root. */
function insideShadowRoot(parameters: JsonObject): boolean {
  const hosts = objectValue(objectValue(parameters.element)?.context)?.shadowHosts;
  return Array.isArray(hosts) && hosts.length > 0;
}

/** Whether a skipped entry reports a URL that is not the mutation's document. */
function namesAnotherDocument(step: RecordedStep, document: string): boolean {
  const url = step.payload.url ?? objectValue(step.payload.latestEvidence)?.url;
  const key = documentKey(url);
  return key !== undefined && key !== document;
}

/** A URL without its fragment, which does not change the document; `undefined` when the value is not a URL. */
function documentKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch {
    return undefined;
  }
}

function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
