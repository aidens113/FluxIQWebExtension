// What a build's call names, in words a person reads, for the chat alone.
//
// The chat said "Looking at the page", "Working on the page" and "Typing into
// the page" for every step of the crossborder build (`run-muqc07fh-eeffbc86`),
// which hid what the run was doing: which control it pressed, what it typed,
// what it looked for. Core cannot say, because a call names a control by a
// handle and only this domain knows what a handle stands for. So Core asks
// (`describeCall` on the binding) and shows the answer in the step's heading
// and on its card ("Typing "USB-C hub" into “Search”").
//
// - `target` is the accessible name, else the visible words, of the control the
//   call's handle names on a page this build was shown. A step that carries no
//   handle the build was shown -- a dry run's, a rerun's, a recorded node's --
//   carries the element's identity instead (`parameters.element`), and is named
//   from that: those read a bare "Test run" and "Click · the page" (t193,
//   `run-muqiojz4-04a7a8fc`). The looks that name a control by handle are named
//   the same way: the element whose details are read (`web.describe_element`)
//   and the one a list is detected around (`web.detect_repeating_structure`),
//   each also as the repair harness offers it (`web.recovery.*`). A control a
//   page lays out as separate lines is named as the packet printed it ("12
//   Double Rolls $16.47"), the resolution's `words`, not as its identity's
//   captured text runs them together (U-B3-3, `run-mux6pndp-16feb842`, whose
//   draft read `does.target: 12 Double Rolls$16.47`). A list read
//   (`web.output.dom-extract_list`) is named by the fields it reads. A Next
//   page step (`web.output.dom-next_page`) is named by the page's own control
//   when the call names one the build was shown (`nextPage.control`), and
//   otherwise as the list's "Next page": the model names the list by a
//   detection handle, which is no words, and the step is never "paginate".
// - `text` is the words the call types (`web.dom.type`), the key it presses
//   (`web.dom.keypress`), or the words it looks for (`web.find_on_page`). The
//   words typed are said only into a control this domain can name and does not
//   screen as sensitive: never into a password or card field, never into a
//   control it cannot name, and never a secret request, which is not words.
//
// Core turns these into the sentence by the call's verb ("Reading the details
// of “Colour”"); nothing here writes a sentence, decides anything, or changes
// the shape Core reads. An answer that cannot be given is no answer.

import type { JsonObject } from "fluxiq/core";
import { isSensitiveFieldSignature } from "../../../sensitivity";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import type { WebLlmTargetResolution, WebLlmTargetScope } from "../plan-resolution";
import { present } from "../present";
import { WEB_LLM_RUN_NODE_TOOL_ID } from "../vocabulary";

/** The words a call names, as Core's chat shows them. */
export type WebLlmCallWords = { target?: string; text?: string };

type Element = { accessibleName?: unknown; visibleText?: unknown; inputType?: unknown };
/** A control a handle names on a page this build was shown: its identity, and the words a person reads for it when they are spelled otherwise. */
type Shown = { element: Element; words: string | undefined };

const FIND_TOOL_IDS: ReadonlySet<string> = new Set(["web.find_on_page", "web.recovery.find_on_page"]);
/** Tools whose `target` is one handle and that type nothing: looks at a control, and the repair harness's press. */
const HANDLE_TOOL_IDS: ReadonlySet<string> = new Set([
  "web.describe_element",
  "web.detect_repeating_structure",
  "web.recovery.describe_element",
  "web.recovery.detect_repeating_structure",
  "web.recovery.press"
]);
/** The repair harness's field entry: a `target` handle and the `value` it enters. */
const ENTER_FIELD_TOOL_ID = "web.recovery.enter_field";
const TYPE_NODE = "web.output.dom-type";
const KEY_NODE = "web.output.dom-keypress";
const LIST_NODE = "web.output.dom-extract_list";
const NEXT_PAGE_NODE = "web.output.dom-next_page";
/** What a Next page step is called when the call names no control of the page's own: the node's own label. */
const NEXT_PAGE_WORDS = "Next page";
/** The most field names a list read's subject lists before it says how many more. */
const MAX_FIELDS = 3;

/**
 * The fields a list read reads, by the names its author gave them ("name,
 * price, rating and 3 more"), never the selectors behind them nor a value read.
 * A build's test named every step but this one, a bare "Test run" (t194,
 * `run-murwcmx2-a1c6edf7`, screenshot 00016). `fields` is the request's map of
 * name to selector, or a list of names.
 */
function fieldsRead(fields: unknown): string | undefined {
  const written = Array.isArray(fields)
    ? fields.map((field) => typeof field === "string" ? field : stringOf(objectOf(field)?.name))
    : Object.keys(objectOf(fields) ?? {});
  const names = [...new Set(written.map((name) => name?.replace(/[_-]+/gu, " ").replace(/\s+/gu, " ").trim()).filter((name): name is string => Boolean(name)))];
  if (names.length === 0) return undefined;
  const shown = names.slice(0, MAX_FIELDS);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}` : shown[0];
}

/** What `call` names, from the pages this build was shown (`resolve`), or nothing. */
export function webLlmCallWords(
  call: WebLlmTargetScope & { toolId: string; value: JsonObject },
  resolve: (scope: WebLlmTargetScope, handle: string) => WebLlmTargetResolution
): WebLlmCallWords | undefined {
  const scope = { projectId: call.projectId, flowId: call.flowId };
  const shown = (written: unknown): Shown | undefined => {
    const handle = typeof written === "string" ? canonicalWebLlmTargetHandle(written) : undefined;
    const resolved = handle === undefined ? undefined : resolve(scope, handle);
    return resolved?.ok ? { element: resolved.element, words: resolved.words } : undefined;
  };
  if (FIND_TOOL_IDS.has(call.toolId)) return wordsOf(undefined, stringOf(call.value.query));
  if (HANDLE_TOOL_IDS.has(call.toolId)) return wordsOf(shownName(shown(call.value.target)), undefined);
  if (call.toolId === ENTER_FIELD_TOOL_ID) {
    const found = shown(call.value.target);
    return wordsOf(shownName(found), sayableInto(found?.element) ? stringOf(call.value.value) : undefined);
  }
  if (call.toolId !== WEB_LLM_RUN_NODE_TOOL_ID) return undefined;
  const parameters = objectOf(call.value.parameters);
  if (!parameters) return undefined;
  if (stringOf(call.value.node) === LIST_NODE) return wordsOf(fieldsRead(objectOf(parameters.extractList)?.fields), undefined);
  if (stringOf(call.value.node) === NEXT_PAGE_NODE) return wordsOf(shownName(shown(objectOf(parameters.nextPage)?.control)) ?? NEXT_PAGE_WORDS, undefined);
  // A handle the build was shown first; else the identity the step carries.
  const found = elementOf(parameters, shown);
  const element = found?.element ?? objectOf(parameters.element) as Element | undefined;
  const target = found === undefined ? nameOf(element) : shownName(found);
  const node = stringOf(call.value.node);
  if (node === KEY_NODE) return wordsOf(target, stringOf(parameters.key));
  if (node !== TYPE_NODE) return wordsOf(target, undefined);
  return wordsOf(target, sayableInto(element) ? stringOf(parameters.text) : undefined);
}

/** The element a run-node call's handle names, written any of the ways the resolver reads one. */
function elementOf(parameters: JsonObject, shown: (written: unknown) => Shown | undefined): Shown | undefined {
  for (const written of [objectOf(parameters.target)?.handle, objectOf(parameters.element)?.handle, parameters.selector]) {
    const element = shown(written);
    if (element !== undefined) return element;
  }
  return undefined;
}

/** The words typed are said only into a control this domain can name and knows not to hold a secret. */
function sayableInto(element: Element | undefined): boolean {
  if (element === undefined || nameOf(element) === undefined) return false;
  return !isSensitiveFieldSignature({ inputType: typeof element.inputType === "string" ? element.inputType : undefined });
}

/** A shown control's name: the words a person reads for it, else its identity's name. */
function shownName(found: Shown | undefined): string | undefined {
  return found === undefined ? undefined : stringOf(found.words) ?? nameOf(found.element);
}

function nameOf(element: Element | undefined): string | undefined {
  return stringOf(element?.accessibleName) ?? stringOf(element?.visibleText);
}

function wordsOf(target: string | undefined, text: string | undefined): WebLlmCallWords | undefined {
  if (target === undefined && text === undefined) return undefined;
  return present<WebLlmCallWords>({ target, text });
}

function stringOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function objectOf(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}
