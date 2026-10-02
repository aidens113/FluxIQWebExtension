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
//   call's handle names on a page this build was shown.
// - `text` is the words the call types (`web.dom.type`), the key it presses
//   (`web.dom.keypress`), or the words it looks for (`web.find_on_page`). The
//   words typed are said only into a control this domain knows and does not
//   screen as sensitive: never into a password or card field, never into a
//   control it cannot name, and never a secret request, which is not words.
//
// Nothing here decides anything; an answer that cannot be given is no answer.

import type { JsonObject } from "fluxiq/core";
import { isSensitiveFieldSignature } from "../../../sensitivity";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import type { WebLlmTargetResolution, WebLlmTargetScope } from "../plan-resolution";
import { present } from "../present";
import { WEB_LLM_RUN_NODE_TOOL_ID } from "../vocabulary";

/** The words a call names, as Core's chat shows them. */
export type WebLlmCallWords = { target?: string; text?: string };

const FIND_TOOL_ID = "web.find_on_page";
const TYPE_NODE = "web.output.dom-type";
const KEY_NODE = "web.output.dom-keypress";

/** What `call` names, from the pages this build was shown (`resolve`), or nothing. */
export function webLlmCallWords(
  call: WebLlmTargetScope & { toolId: string; value: JsonObject },
  resolve: (scope: WebLlmTargetScope, handle: string) => WebLlmTargetResolution
): WebLlmCallWords | undefined {
  if (call.toolId === FIND_TOOL_ID) return wordsOf(undefined, stringOf(call.value.query));
  if (call.toolId !== WEB_LLM_RUN_NODE_TOOL_ID) return undefined;
  const parameters = objectOf(call.value.parameters);
  if (!parameters) return undefined;
  const handle = handleOf(parameters);
  const resolved = handle === undefined ? undefined : resolve({ projectId: call.projectId, flowId: call.flowId }, handle);
  const element = resolved?.ok ? resolved.element : undefined;
  const target = stringOf(element?.accessibleName) ?? stringOf(element?.visibleText);
  const node = stringOf(call.value.node);
  if (node === KEY_NODE) return wordsOf(target, stringOf(parameters.key));
  if (node !== TYPE_NODE) return wordsOf(target, undefined);
  // The words typed only into a control known not to hold a secret.
  const sayable = element !== undefined && !isSensitiveFieldSignature({ inputType: element.inputType });
  return wordsOf(target, sayable ? stringOf(parameters.text) : undefined);
}

/** The handle a run-node call's parameters name its control by, written any of the ways the resolver reads. */
function handleOf(parameters: JsonObject): string | undefined {
  for (const written of [objectOf(parameters.target)?.handle, objectOf(parameters.element)?.handle, parameters.selector]) {
    const handle = typeof written === "string" ? canonicalWebLlmTargetHandle(written) : undefined;
    if (handle !== undefined) return handle;
  }
  return undefined;
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
