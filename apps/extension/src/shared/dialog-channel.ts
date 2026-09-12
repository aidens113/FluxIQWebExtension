// The contract between the two worlds that answer a native dialog.
//
// `alert`, `confirm`, and `prompt` block the page's script the moment they are
// called, so nothing in an isolated content script can answer one after it
// opens: the override has to live in the page's own world (`page-world/`),
// installed before any page script can capture the originals. The two halves
// are separate bundles in separate JavaScript worlds and cannot share a module
// instance, so they need a channel, and it has to be synchronous -- `arm()`
// must return whether the override is there before the verb reports, and the
// override must read the arming while a dialog call is already on the stack.
//
// The DOM is the only surface both worlds see synchronously. So the arming and
// what the override did travel as attributes on the document element, and a DOM
// event dispatched on `document` -- which listeners in both worlds receive
// synchronously, on the dispatching call stack -- carries the handshake. The
// payloads are JSON strings rather than an event `detail`, because a structured
// `detail` does not cross world boundaries uniformly across browsers.
//
// This module imports nothing: both bundles include it, and the page-world
// bundle must stay free of extension, domain, and Core code.

export type DialogResponse = "accept" | "dismiss";

export type DialogKind = "alert" | "confirm" | "prompt" | "beforeunload";

/** How the next dialog should be answered. `promptText` is the reply to a `prompt`, and only with `accept`. */
export type DialogArm = { response: DialogResponse; promptText?: string | undefined };

/** A dialog the override actually handled. */
export type DialogObserved = {
  kind: DialogKind;
  message: string;
  response: DialogResponse;
  promptText?: string | undefined;
  at: number;
};

/** Written by the isolated world, consumed and removed by the page world. Its removal is the acknowledgement. */
export const DIALOG_ARM_ATTRIBUTE = "data-fluxiq-dialog-arm";

/** Written by the page world after it answers a dialog; read by the isolated world as evidence. */
export const DIALOG_OBSERVED_ATTRIBUTE = "data-fluxiq-dialog-observed";

/** Dispatched on `document` by the isolated world so the page world reads the arming on the same call stack. */
export const DIALOG_ARM_EVENT = "fluxiq:dialog-arm";

/**
 * The bound on the dialog text carried across the channel. A page's dialog
 * message is unbounded, and it ends up in a result's validation, which Core's
 * parser drops whole rather than truncating -- the same reason
 * `content/action-runtime/validation-outcome.ts` bounds its text.
 */
export const DIALOG_TEXT_MAX_LENGTH = 1_024;

export function encodeDialogArm(arm: DialogArm): string {
  return JSON.stringify({
    response: arm.response,
    ...(arm.promptText === undefined ? {} : { promptText: boundText(arm.promptText) })
  });
}

export function decodeDialogArm(raw: string): DialogArm | undefined {
  const value = parseObject(raw);
  if (!value) return undefined;
  const response = dialogResponse(value["response"]);
  if (!response) return undefined;
  const promptText = value["promptText"];
  return typeof promptText === "string" ? { response, promptText } : { response };
}

export function encodeDialogObserved(observed: DialogObserved): string {
  return JSON.stringify({
    kind: observed.kind,
    message: boundText(observed.message),
    response: observed.response,
    at: observed.at,
    ...(observed.promptText === undefined ? {} : { promptText: boundText(observed.promptText) })
  });
}

export function decodeDialogObserved(raw: string): DialogObserved | undefined {
  const value = parseObject(raw);
  if (!value) return undefined;
  const response = dialogResponse(value["response"]);
  const kind = dialogKind(value["kind"]);
  const message = value["message"];
  const at = value["at"];
  if (!response || !kind || typeof message !== "string" || typeof at !== "number") return undefined;
  const promptText = value["promptText"];
  return typeof promptText === "string"
    ? { kind, message, response, promptText, at }
    : { kind, message, response, at };
}

function boundText(value: string): string {
  return value.length <= DIALOG_TEXT_MAX_LENGTH ? value : value.slice(0, DIALOG_TEXT_MAX_LENGTH);
}

function parseObject(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function dialogResponse(value: unknown): DialogResponse | undefined {
  return value === "accept" || value === "dismiss" ? value : undefined;
}

function dialogKind(value: unknown): DialogKind | undefined {
  return value === "alert" || value === "confirm" || value === "prompt" || value === "beforeunload" ? value : undefined;
}
