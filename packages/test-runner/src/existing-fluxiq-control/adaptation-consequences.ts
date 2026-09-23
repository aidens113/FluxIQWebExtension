// What a Flow Bootstrap proposal says its own steps would lastingly do, and
// Core's reading of that against the person's instruction.
//
// It is read from `metadata.bootstrap` and nowhere else.
// `adaptation.instructedConsequences` at the top level of a Flow adaptation was
// read until 2026-09-23 and is never populated for a bootstrap proposal:
// `bootstrapAdaptationAsFlowAdaptation` projects all four members under
// `metadata.bootstrap`, so every build this facility had measured reported an
// empty declaration while the stored proposal held a full one
// (`fa-permission-loop-holes.md`, open question 1).
//
// Nothing here is interpreted. The classes stay the strings Core wrote, so a
// class Core adds is reported rather than dropped, and the control's name is
// kept as Core left it -- already withheld unless it appears in evidence the
// model was shown.

import { parseAutomationStudioActionPermissionRequest, type AutomationStudioActionPermissionRequest } from "fluxiq/automation-studio/action-permissions";
import { array, integer, invalid, optionalRecord, record, stringArray, text, type JsonRecord } from "./api-readings.js";

/** Core's cap on the declarations one gate keeps (`AUTOMATION_STUDIO_ACTION_DECLARATIONS_MAX`); more than that is not a record Core wrote. */
const MAX_DECLARED_ACTIONS = 500;
/** A quote is the person's own words, bounded as Core bounds them, kept only to say why a class was read into the instruction. */
const MAX_INSTRUCTION_QUOTE = 300;

/** One action the build put to Core's permission gate, as Core recorded the declaration and its own answer. */
export type ExistingAdaptationDeclaredAction = {
  /** `exploration_step` for a node the build ran while exploring (a dry-run replay among them), `flow_step` for a step of the Flow being authored. */
  actionKind: string;
  /** The node definition the action ran. */
  actionId: string;
  /** The call id, or the step's ref: what joins this record to the build's trace. */
  ref: string;
  verb: string;
  /** Withheld by Core as `null` when the model was never shown that name. */
  controlName: string | null;
  controlKind: string | null;
  consequences: string[];
  permitted: boolean;
  missing?: string[];
};

/** Core's reading of what the build declared against what the person's instruction asks for. */
export type ExistingAdaptationConsequenceCrossCheck = {
  verdict: string;
  declared: string[];
  instructed: string[];
  undeclared: string[];
  beyondInstruction: string[];
  actions: number;
  declaredNothing: number;
};

export type ExistingAdaptationConsequences = {
  instructed: Array<{ consequence: string; quote: string }>;
  declared: ExistingAdaptationDeclaredAction[];
  crossCheck?: ExistingAdaptationConsequenceCrossCheck;
  /**
   * The question the build carries out to a person, present exactly when the
   * gate raised one that nobody granted -- a granted request is forgotten by
   * the gate, so what survives here is an unanswered one. Core refuses to
   * approve or apply such a proposal (`FLOW_BOOTSTRAP_PERMISSION_REQUIRED`),
   * so a reader that sees this knows the build parked.
   */
  permissionRequest?: AutomationStudioActionPermissionRequest;
};

/**
 * The four members, or `undefined` when Core published none of them -- which
 * is every adaptation that is not an evidence-guided bootstrap.
 */
export function adaptationConsequences(bootstrap: JsonRecord | undefined, at: string): ExistingAdaptationConsequences | undefined {
  if (!bootstrap) return undefined;
  const present = bootstrap.instructedConsequences !== undefined || bootstrap.declaredConsequences !== undefined
    || bootstrap.consequenceCrossCheck !== undefined || bootstrap.permissionRequest !== undefined;
  if (!present) return undefined;
  const instructedRaw = bootstrap.instructedConsequences === undefined ? [] : array(bootstrap.instructedConsequences, `${at}.instructedConsequences`);
  const declaredRaw = bootstrap.declaredConsequences === undefined ? [] : array(bootstrap.declaredConsequences, `${at}.declaredConsequences`);
  if (declaredRaw.length > MAX_DECLARED_ACTIONS) invalid(`${at}.declaredConsequences holds more declarations than Core's gate keeps`);
  const instructed = instructedRaw.map((entry, index) => {
    const item = record(entry, `${at}.instructedConsequences[${index}]`);
    return {
      consequence: text(item.consequence, `${at}.instructedConsequences[${index}].consequence`),
      quote: text(item.quote, `${at}.instructedConsequences[${index}].quote`).slice(0, MAX_INSTRUCTION_QUOTE),
    };
  });
  const declared = declaredRaw.map((entry, index) => declaredAction(entry, `${at}.declaredConsequences[${index}]`));
  const rawCrossCheck = optionalRecord(bootstrap.consequenceCrossCheck, `${at}.consequenceCrossCheck`);
  const crossCheck = rawCrossCheck ? {
    verdict: text(rawCrossCheck.verdict, `${at}.consequenceCrossCheck.verdict`),
    declared: stringArray(rawCrossCheck.declared ?? [], `${at}.consequenceCrossCheck.declared`),
    instructed: stringArray(rawCrossCheck.instructed ?? [], `${at}.consequenceCrossCheck.instructed`),
    undeclared: stringArray(rawCrossCheck.undeclared ?? [], `${at}.consequenceCrossCheck.undeclared`),
    beyondInstruction: stringArray(rawCrossCheck.beyondInstruction ?? [], `${at}.consequenceCrossCheck.beyondInstruction`),
    actions: integer(rawCrossCheck.actions, `${at}.consequenceCrossCheck.actions`),
    declaredNothing: integer(rawCrossCheck.declaredNothing, `${at}.consequenceCrossCheck.declaredNothing`),
  } : undefined;
  const raised = bootstrap.permissionRequest === undefined || bootstrap.permissionRequest === null ? undefined : bootstrap.permissionRequest;
  const permissionRequest = raised === undefined ? undefined : parseAutomationStudioActionPermissionRequest(raised);
  if (raised !== undefined && !permissionRequest) invalid(`${at}.permissionRequest is not a permission request Core built`);
  return { instructed, declared, ...(crossCheck ? { crossCheck } : {}), ...(permissionRequest ? { permissionRequest } : {}) };
}

function declaredAction(entry: unknown, at: string): ExistingAdaptationDeclaredAction {
  const item = record(entry, at);
  const action = record(item.action, `${at}.action`);
  const control = record(item.control, `${at}.control`);
  return {
    actionKind: text(action.kind, `${at}.action.kind`),
    actionId: text(action.id, `${at}.action.id`),
    ref: text(action.ref, `${at}.action.ref`),
    verb: text(action.verb, `${at}.action.verb`),
    controlName: typeof control.name === "string" ? control.name : null,
    controlKind: typeof control.kind === "string" ? control.kind : null,
    consequences: stringArray(item.consequences ?? [], `${at}.consequences`),
    permitted: item.permitted === true,
    ...(item.missing === undefined ? {} : { missing: stringArray(item.missing, `${at}.missing`) }),
  };
}
