// Room for a command to wait out a robot check that clears by itself.
//
// **Why the command carries it.** A navigation or a click can land on a check
// that lifts on its own -- bigbox's "Robot or human?" after 8 s, auction's
// "Checking your browser" after 5 s -- and the extension waits those out in
// place rather than handing them to a person or reloading into them
// (`apps/extension/src/runtime/landed-check-wait.ts`). But Core gives a command
// `timeoutMs` plus a three-second answer margin and then drops a late answer,
// and a recorded click's `timeoutMs` is Core's default 5,000 ms. The wait was
// cut to about four seconds and every 8 s check went to a person, who found it
// already gone (`run-munx9bvj-a7ba7442`, node `entry.13`, 3,913 ms).
//
// So a command that can land on a check is given the allowance on top of its
// own timeout, which is what makes Core's deadline cover the wait, and says so
// in `checkWaitMs`, which is what lets the extension keep every *other* wait on
// the timeout the command had before. An ordinary click that meets no check
// behaves exactly as it did; only a command that is actually waiting out a
// check uses the extra time.
//
// **One allowance, wherever the command was made.** A recording, a model
// building a Flow, and the Flow it built all make clicks and navigations, and
// each is given the allowance here rather than by a rule of its own:
//
// - a recorded node, on its node timeout (`web-panel-host.ts`: the candidate
//   the domain maps, and every click or navigation `action` entry, which it
//   proposes in place of Core's fallback so none runs on Core's bare default);
// - a Run Output node a model wrote, the same way
//   (`runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`);
// - a web output node -- the node a model's build appends -- on the parameters
//   it dispatches, both when the build runs it (the gateway of
//   `runtime/llm-evidence/tools.ts`, which every build command goes out
//   through) and when the Flow does (`output-nodes/native-runtime.ts`).
//
// Before that only recorded nodes had it, and a built press on bigbox's 8 s
// check was given about four seconds and failed (`run-muoga8at`).
//
// Adding it is idempotent: the timeout it is added to is the one the command
// had before any allowance (`webAutomationBaseTimeoutMs`), so a command that
// passes through two of these places carries it once.
//
// **A look carries it too** (t885, `run-mwaknxf9-7549d126`). A sort's reply
// arrived from the old document, and the look after it captured bigbox's
// "Robot or human?" page as an ordinary page; the model, shown the check as a
// page, stopped on it although it lifted by itself seconds later. A whole-tab
// look that carries `checkWaitMs` is judged by the extension as a landing is
// (`apps/extension/src/runtime/look-check.ts`): a check that clears by itself
// is waited out, and one only a person can answer comes back
// USER_INTERVENTION_REQUIRED, which the domain turns into `personNeeded`. A
// look that names no `checkWaitMs` -- a host state capture, a re-acquire, the
// recorder -- reads a check page as a page, as before, and so does a look
// addressed to one frame, whose scope is that frame and not the page.
//
// This follows the paginated read (`extraction/request.ts`), which scales its
// `timeoutMs` for the same reason: Core sends the node's timeout as the
// command's, and a default sized for one quick action cuts a longer honest one
// short.

import type { JsonObject, JsonValue } from "fluxiq/core";

/** How long a command may spend waiting out a check that said it would clear by itself. */
export const WEB_AUTOMATION_CHECK_WAIT_MS = 15_000;

/** Core's timeout for an action node that names none (`nodes/policy/action.ts`). */
export const WEB_AUTOMATION_DEFAULT_ACTION_TIMEOUT_MS = 5_000;

/** The actions whose command can land on a check: the ones that load or change the page. */
export const WEB_AUTOMATION_CHECK_WAIT_ACTIONS: readonly string[] = ["web.dom.click", "web.browser.navigate"];

/** A look at the page: given the allowance when it looks at the whole tab (`webAutomationCommandWaitsOutChecks`). */
const WEB_AUTOMATION_LOOK_ACTION = "web.dom.capture_snapshot";

/** Whether an action's command is given the check allowance. */
export function webAutomationActionWaitsOutChecks(outputId: string): boolean {
  return WEB_AUTOMATION_CHECK_WAIT_ACTIONS.includes(outputId);
}

/**
 * Whether this command is given the check allowance: a click or a navigation,
 * and also typing that sends its form (`submit`) and a press of Enter, which
 * land as a click does (`apps/extension/src/runtime/click-landing.ts`). t193's
 * run 39 typed a bigbox search with `submit`, landed on the store's eight-second
 * "Robot or human?" check, and was handed it standing. Typing that sends
 * nothing, and any other key, keep the timeout they had.
 *
 * A look at the whole tab is given it as well, so a check it meets is waited
 * out or handed to the person rather than shown as a page (t885). A look
 * addressed to one frame is not: the extension never judges a frame's look for
 * a page's check, so the allowance would only lengthen its deadline.
 */
export function webAutomationCommandWaitsOutChecks(outputId: string, parameters: JsonObject): boolean {
  if (webAutomationActionWaitsOutChecks(outputId)) return true;
  // A check or a choice may reload its page onto a check (t885), and the extension judges that landing.
  if (outputId === "web.dom.select" || outputId === "web.dom.check") return true;
  if (outputId === "web.dom.type") return parameters.submit === true;
  if (outputId === WEB_AUTOMATION_LOOK_ACTION) return parameters.browserFrameId === undefined && parameters.browserFrameUrlPath === undefined;
  return outputId === "web.dom.keypress" && (parameters.key ?? parameters.text) === "Enter";
}

/**
 * The timeout a command had before the check allowance was added to it: what
 * every wait but the check's own is bounded by. `undefined` when the command
 * names no timeout.
 */
export function webAutomationBaseTimeoutMs(command: { timeoutMs?: number | undefined; checkWaitMs?: number | undefined }): number | undefined {
  const { timeoutMs, checkWaitMs } = command;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined;
  if (typeof checkWaitMs !== "number" || !Number.isFinite(checkWaitMs) || checkWaitMs <= 0) return timeoutMs;
  // Never below a positive remainder: an allowance larger than the timeout it
  // was added to is a malformed command, and the whole of it stays bounded.
  return timeoutMs > checkWaitMs ? timeoutMs - checkWaitMs : timeoutMs;
}

/** A node's parameters, and the timeout Core reads off the node itself. */
export type WebAutomationCheckWaitNode = { parameters: JsonObject; timeoutMs?: number | undefined };

/**
 * A node whose timeout Core reads off the node rather than its parameters -- a
 * recorded node, and Core's Run Output node -- carrying the check allowance
 * when it is a click or a navigation: `checkWaitMs` in its parameters, and the
 * allowance on top of the timeout it names, less any allowance it already
 * carries, or on top of Core's default when it names none
 * (`nodes/policy/action.ts`). Any other node is returned as it is.
 */
export function webAutomationCheckWaitNode(outputId: string, node: WebAutomationCheckWaitNode): WebAutomationCheckWaitNode {
  if (!webAutomationCommandWaitsOutChecks(outputId, node.parameters)) return node;
  const base = webAutomationBaseTimeoutMs({ timeoutMs: node.timeoutMs, checkWaitMs: numeric(node.parameters.checkWaitMs) }) ?? WEB_AUTOMATION_DEFAULT_ACTION_TIMEOUT_MS;
  return { parameters: { ...node.parameters, checkWaitMs: WEB_AUTOMATION_CHECK_WAIT_MS }, timeoutMs: base + WEB_AUTOMATION_CHECK_WAIT_MS };
}

/**
 * The parameters an action is dispatched with, carrying the check allowance
 * when it is a click or a navigation: `checkWaitMs`, and the allowance added to
 * the `timeoutMs` they name. Parameters that name no timeout keep naming none:
 * the page then gives the check its whole wait, and Core waits its own command
 * default, which is longer. Any other action's parameters are returned as they
 * are.
 */
export function webAutomationCheckWaitParameters(outputId: string, parameters: JsonObject): JsonObject {
  if (!webAutomationCommandWaitsOutChecks(outputId, parameters)) return parameters;
  const base = webAutomationBaseTimeoutMs({ timeoutMs: numeric(parameters.timeoutMs), checkWaitMs: numeric(parameters.checkWaitMs) });
  return {
    ...parameters,
    ...(base === undefined ? {} : { timeoutMs: base + WEB_AUTOMATION_CHECK_WAIT_MS }),
    checkWaitMs: WEB_AUTOMATION_CHECK_WAIT_MS
  };
}

function numeric(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}
