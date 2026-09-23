// Putting a step of the Flow being built to Core's permission gate.
//
// Until this existed, nothing did. Core hands the domain a permission check
// with every plan node it asks about (`runtime/llm/harness-options/
// plan-parameter-resolution.ts`), and the web domain declared no such field and
// never called it, so every step of every created Flow passed ungated. Measured
// live (`run-mud4ywy4-45c2002f`): a nine-node Flow that filled a scheduler's
// composer and submitted it was authored and replayed under a grant that
// permitted nothing, with `permissionRequest: null` and
// `instructedConsequences: []`. Nobody was asked anything. The exploration
// press tool had been asking about its own presses since 2026-09-18, and the
// one place a lasting act actually lands -- the Flow -- asked about none.
//
// **The model declares; nothing here reads a control.** Which classes a step
// would cause is the model's statement about its own step, carried on the step
// and read off it by Core (`automationStudioPlanStepConsequences`). This module
// adds only what Core cannot know -- which control the step acts on, as the
// model was shown it, and the verb -- and calls the check. There is no word
// list and no reading of what a button looks like: the standing product rule is
// that FluxIQ refuses nothing on its own judgement of a control, and that the
// user's instruction or grant is the only authority. Core holds both.
//
// **A step that commits must say so, even to say it does nothing.** A press is
// the one web action whose consequence cannot be worked out from the action:
// the same `web.dom.click` applies a filter on one page and places an order on
// the next. Entering text into a field that is not yet submitted, choosing an
// option, arriving at an address, scrolling and reading are not consequences at
// all -- Core says so in `action-permissions/consequences.ts` -- so none of them
// is asked about. So a committing step is refused until it declares, `none`
// included, exactly as the exploration press tool requires `consequences` on
// every call. Treating an undeclared press as harmless is what the live run
// above did, and it is how a Flow came to publish with nobody asked.
//
// **An empty declaration is put to Core too.** A step that says `none` used to
// stop here and Core never heard of it, so the only record a permitted press
// left anywhere was that it had not been refused -- which is how four live
// builds authored Flows containing presses with nobody able to say what any
// press declared. It now goes to the check like any other, is permitted
// because there is nothing to permit, and is recorded against the step.
//
// **A refusal here is not the same event as a refusal of how a step was
// written.** `needs_permission` says a person must answer; no rewrite of the
// plan can. `refused` says the model wrote something this domain will not
// accept, which it can correct and be asked again.

import type { AutomationStudioActionConsequence, AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionType } from "../../../actions/types";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import { webActionPermission } from "../permission";
import { isJsonRecord } from "../untrusted-json";

/**
 * Every code a step-level refusal is made of: why the step was refused, then
 * what a step of that kind must say and in which shape.
 */
export const WEB_PLAN_STEP_ISSUE_CODES = [
  // The step presses something and said nothing about what that would cause.
  "web.step.consequences_undeclared",
  // `consequences: <classes, comma separated>` on the step, or `consequences: none`.
  "web.step.expected.consequences_classes_or_none"
] as const;

export type WebPlanStepIssueCode = (typeof WEB_PLAN_STEP_ISSUE_CODES)[number];

/** How a step stands with the gate: nothing to ask, asked and allowed, refused, or it never said. */
export type WebPlanStepPermission =
  | { kind: "clear" }
  | { kind: "undeclared" }
  | { kind: "refused"; missing: readonly AutomationStudioActionConsequence[]; requestId: string | null };

/**
 * The web actions that commit: the ones whose effect is the page's to decide
 * rather than the action's. Everything else changes only what is shown, or what
 * a field holds before anything submits it, and Core does not gate either.
 */
const COMMITTING_ACTIONS: readonly WebAutomationActionType[] = ["web.dom.click", "web.dom.keypress", "web.dom.dialog"];

const COMMITTING_NODE_IDS: ReadonlySet<string> = new Set(COMMITTING_ACTIONS.map((action) => webAutomationOutputNodeId(action)));

/** What each action does to its control, in the plain word a person being asked would use. */
const VERBS: Partial<Record<WebAutomationActionType, string>> = {
  "web.dom.click": "press",
  "web.dom.keypress": "press",
  "web.dom.dialog": "accept",
  "web.dom.type": "enter",
  "web.dom.clear": "clear",
  "web.dom.select": "choose",
  "web.dom.upload": "upload",
  "web.browser.navigate": "open",
  "web.browser.download": "download"
};

/** Whether a step running this node must say what it would lastingly do. */
export function webPlanStepMustDeclare(nodeDefinitionId: string): boolean {
  return COMMITTING_NODE_IDS.has(nodeDefinitionId);
}

/**
 * Ask Core about this step, given what the step said it would do.
 *
 * `parameters` are the step's own, after resolution: they carry the identity of
 * the element the handle named, which is how the request reaches the person
 * saying which control. A step with no identity is still asked about -- Core
 * withholds a name it cannot find in evidence already shown rather than
 * refusing to ask.
 */
export async function webPlanStepPermission(input: {
  nodeDefinitionId: string;
  declared: readonly AutomationStudioActionConsequence[] | undefined;
  check: AutomationStudioActionPermissionCheck | undefined;
  parameters: JsonObject;
}): Promise<WebPlanStepPermission> {
  if (input.declared === undefined) return webPlanStepMustDeclare(input.nodeDefinitionId) ? { kind: "undeclared" } : { kind: "clear" };
  const identity = isJsonRecord(input.parameters.element) ? input.parameters.element : undefined;
  const permission = await webActionPermission({
    check: input.check,
    declared: [...input.declared],
    control: { name: controlName(identity), kind: controlKind(identity) },
    verb: verbFor(input.nodeDefinitionId)
  });
  return permission.kind === "refused" ? { kind: "refused", missing: permission.missing, requestId: permission.requestId } : { kind: "clear" };
}

/** The words the model was shown for the control, which is the only name Core may carry. */
function controlName(identity: JsonObject | undefined): string | undefined {
  const visible = typeof identity?.visibleText === "string" ? identity.visibleText : undefined;
  const named = typeof identity?.accessibleName === "string" ? identity.accessibleName : undefined;
  return visible?.trim() || named?.trim() || undefined;
}

/** One plain word for what sort of thing it is, from what the element said it was. */
function controlKind(identity: JsonObject | undefined): string {
  const role = typeof identity?.role === "string" ? identity.role : undefined;
  const tag = typeof identity?.tagName === "string" ? identity.tagName.toLowerCase() : undefined;
  if (tag === "a") return "link";
  if (tag === "button" || role === "button") return "button";
  return role && /^[a-z][a-z -]{0,31}$/.test(role) ? role : "control";
}

/** The verb for the node's own action, read back off the output node id. */
function verbFor(nodeDefinitionId: string): string {
  const action = (Object.keys(VERBS) as WebAutomationActionType[]).find((type) => webAutomationOutputNodeId(type) === nodeDefinitionId);
  return (action && VERBS[action]) || "run";
}
