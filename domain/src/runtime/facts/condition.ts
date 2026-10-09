// Core's fact condition (Core C9) and what this host answers for it, declared
// here until Core's host interface carries them (R2 wires it). The shapes are
// C9's word for word, so R2 replaces these declarations with Core's imports
// and nothing else moves.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationFactEvidence, WebAutomationFactVerdict } from "../../actions/fact-check";

/** C9's operators. */
export type WebAutomationFactOp = "exists" | "absent" | "visible" | "enabled" | "equals" | "contains" | "matches" | "count";

/**
 * What a condition compares with: a literal, a Flow input by name, or a bound
 * value by path. The two bindings are resolved from what Core supplies in
 * `WebAutomationFactEvaluationContext`; this host never looks one up itself.
 */
export type WebAutomationFactConditionValue = string | number | boolean | { input: string } | { value: string };

/**
 * One condition. `fact` names the check: `exists`, `absent`, `visible`,
 * `enabled`, `checked`, `selected`, `text`, `url`, `value`, `count`, or
 * `dialog` -- optionally `dialog.<kind>` for one page-evidence kind. `target`
 * is a durable element target: `{ selector?, element? | fingerprint?,
 * shadowHosts?, frameId? }`.
 */
export type WebAutomationFactCondition = {
  fact: string;
  op: WebAutomationFactOp;
  value?: WebAutomationFactConditionValue | undefined;
  target?: JsonObject | undefined;
};

/** C9's answer for one condition. `unknown` never satisfies a guard, and is not `false` either. */
export type WebAutomationFactResult = {
  result: WebAutomationFactVerdict;
  evidence?: WebAutomationFactEvidence | undefined;
  capturedAt: number;
};

/**
 * What Core supplies beside the conditions: the bound Flow inputs and values a
 * condition may compare with, the identity of the document Core last saw (a
 * state snapshot's `documentTimeOrigin`), and the trace context the page-side
 * command carries.
 */
export type WebAutomationFactEvaluationContext = {
  inputs?: Readonly<Record<string, JsonValue>> | undefined;
  values?: Readonly<Record<string, JsonValue>> | undefined;
  documentTimeOrigin?: number | undefined;
  signal?: AbortSignal | undefined;
  nodeId?: string | undefined;
  attemptId?: string | undefined;
};

/** The host method Core calls: one batch in, one result per condition out, in order. Never throws. */
export type WebAutomationFactEvaluator = (
  conditions: readonly (WebAutomationFactCondition | JsonValue)[],
  context?: WebAutomationFactEvaluationContext
) => Promise<WebAutomationFactResult[]>;
