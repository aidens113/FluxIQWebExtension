// The closed set of web-automation failure codes.
//
// Core owns the category names (`AutomationStudioAdaptiveFailureClass`) and the
// record shape; a producer owns the `code`. This module is the one place a
// web-automation code is named, and each code is bound here to the category,
// retryable flag and stage it always carries. That binding is the point: Core's
// parser drops a record whole rather than repairing it, so a record assembled
// by hand can contradict a consistency rule and vanish, losing the failure
// instead of reporting it. A record built from a code here cannot.
//
// The set is closed. The resolver, the content script's action results, the
// domain adapter and the test runner's allowlist all derive from it, so a code
// that is not named here has no way onto the wire from the browser path. Adding
// one is a deliberate edit to this file, not a string written at a call site.

import type { AutomationStudioAdaptiveFailureClass, AutomationStudioFailureRecord, AutomationStudioFailureStage } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH } from "../../actions/types";

/**
 * Every failure the browser path may report, keyed by the plan's vocabulary
 * name and valued by the code that travels on the wire. Read a code from here
 * rather than repeating its string: the key is what the plan, the scenario
 * manifests and the briefs call it, and the value is what Core stores.
 */
export const WEB_AUTOMATION_FAILURE_CODES = Object.freeze({
  /**
   * The action was refused on purpose: a value this extension does not read, a
   * page it may not touch, a key it will not fake, a request it cannot carry out.
   */
  ACTION_REJECTED: "web.action.rejected",
  /**
   * The target was found, and the page as it stood would not let it be used:
   * hidden, covered by another element, or disabled. That is the page's state,
   * not a decision anyone made, so it is Core's `unexpected_state` and a repair
   * may change the Flow to reach the state it needs. Until t193 (2026-10-02) it
   * was ACTION_REJECTED, and lane A's run 40 failed playback on "Set as my
   * store" inside a closed chooser, read by Core as a policy refusal that only a
   * person could answer: the repair was refused at its gate.
   */
  TARGET_NOT_ACTIONABLE: "web.target.not_actionable",
  /** No element matched the action's target with enough confidence. */
  TARGET_NOT_FOUND: "web.target.not_found",
  /** Several elements matched the action's target and none could be preferred. */
  TARGET_AMBIGUOUS: "web.target.ambiguous",
  /** The action ran and its post-condition did not hold (decision D4). */
  OUTPUT_NOT_OBSERVED: "web.validation.output_not_observed",
  /** An authored `web.dom.assert` condition did not hold. */
  STATE_MISMATCH: "web.validation.state_mismatch",
  /** The browser landed somewhere other than the requested URL, or never left where it was. */
  NAVIGATION_UNEXPECTED: "web.navigation.unexpected",
  /**
   * The document was replaced, or routed away, while the action was running.
   * Produced by `apps/extension/src/content/actions/page-identity.ts`, which
   * remembers the page an action started on and supersedes the verb's own code
   * when it finished somewhere else.
   */
  PAGE_CHANGED: "web.page.changed",
  /** A wait, or an action, ran out of time. */
  TIMEOUT: "web.action.timeout",
  /** The host wants a sign-in before the action can continue. */
  AUTH_REQUIRED: "web.auth.required",
  /**
   * A person must act before the run can continue -- Core's category, and it
   * means only what a person alone can answer. Three producers, and they are
   * not the same shape of "act": `content/action-runtime/results.ts` reports it
   * when a dialog over the page asks for what only a person can give -- a robot
   * check, a credential or second-factor code, a payment confirmation -- or
   * when the page itself is such a challenge and the target is not on it;
   * `client/gateway-mapping.ts` when a command still needs a value the run never
   * supplied; and `runtime/adapter.ts` when no single paired client could be
   * selected, which only the operator can fix. A dialog that asks for none of
   * that is BLOCKED_BY_DIALOG, never this: until 2026-09-21 every rendered modal
   * was reported here, so a promotion with its own "Not now" stopped replay and
   * repair alike, and Core refused to ask the model how to get past it.
   */
  USER_INTERVENTION_REQUIRED: "web.intervention.required",
  /**
   * A dialog is open over the page, the target is behind it, and nothing on the
   * dialog asks for what only a person can give: a promotion, a survey, a
   * notifications prompt, a spin-to-win wheel. Produced by
   * `content/action-runtime/results.ts`, which draws the line in
   * `blocking-dialog.ts`. The page is in a state the step did not expect, and
   * answering or closing the dialog is a move recovery can make, so its Core
   * category is `unexpected_state` -- not a person's job, and not a policy
   * refusal. The model is told `web.action.rejected.blocked_by_dialog`.
   */
  BLOCKED_BY_DIALOG: "web.action.blocked_by_dialog",
  /**
   * The page refused a press for going too fast, and said so: a notice the press
   * itself opened -- "You're going too fast ... try again in 12 seconds" -- with
   * nothing confirmed. Produced by `content/actions/click.ts` from what
   * `content/action-runtime/rate-limit-notice.ts` saw.
   *
   * It states the act did not happen (`effect: "unacted"`), as REFUSED_BY_PAGE
   * does, and that is what it is for. A press is a mutating act, and Core refuses to repeat
   * one whose failure may already have landed; the page's own notice is the
   * evidence that nothing landed, so the node's own re-run -- after the wait the
   * page named, which rides on the record as `retryAfterMs` -- does the act. The
   * notice's "Try again" is never pressed on the page's initiative.
   *
   * Until 2026-09-30 the press reported success on its hit test, so a Flow
   * confirming four friend requests on social-network-feed read three of four
   * as accepted and one as done.
   */
  RATE_LIMITED: "web.action.rate_limited",
  /**
   * The page refused a press because it needs something first, and said so in
   * the pressed control's own region: crossborder's Add to cart, pressed with
   * no colour chosen, writes "Please select a Color." and adds nothing. Produced
   * by `content/actions/click.ts` from what
   * `content/action-runtime/rate-limit-notice.ts` saw, matched against a closed
   * phrase list (`content/action-runtime/interference/vocabulary.ts`); the
   * record carries none of the page's words.
   *
   * Not retryable: the same press on the same page is answered the same way,
   * so neither the click's own second press, the content-side recovery loop
   * nor Core's retry rung makes it again. It is the page's state rather than a
   * policy, so its Core category is `unexpected_state`, as
   * TARGET_NOT_ACTIONABLE's is: the move is to give the page what it asked for
   * -- choose the colour -- and press again, which the model or a repair does.
   * Like RATE_LIMITED it states the act did not happen (`effect: "unacted"`),
   * because the page said it did nothing.
   *
   * Until 2026-10-02 the press passed on its hit test, was pressed once more as
   * "ignored", and reported success with nothing in the cart, in exploration,
   * the dry run and playback alike (`run-muqk4u32-0b36e58f`, t174 F40).
   */
  REFUSED_BY_PAGE: "web.action.refused_by_page",
  /**
   * The browser refused the action because this extension may not touch that
   * page: a host the manifest does not request, a `chrome://` or gallery URL, or
   * an enterprise policy that forbids scripting it.
   *
   * It has its own code because the closed set had none, and the cost of that was
   * measured: `test-runs/run-muht9lpw-a39aa056` reported *"Cannot access contents
   * of url \"about:blank\". Extension manifest must request permission to access
   * this host."* as `web.action.failed`, which is **retryable**, so Core's ladder
   * spent three attempts at 250 ms and 1000 ms on a fault only a manifest edit can
   * clear, then fell to diagnosis and ended the run
   * (`docs/working/language-driven-flow-loop-plan/reports/t163-defensive-runtime-audit.md`,
   * section 2). The retry machinery was working exactly as designed and being fed
   * a wrong answer.
   *
   * Absorbing the transient and refusing the deterministic is one rule, not two:
   * a code that says "no retry can help" is as much a part of a defensive runtime
   * as a code that says "wait and try again".
   */
  BROWSER_PERMISSION_DENIED: "web.browser.permission_denied",
  /**
   * The channel to the page failed in a way another attempt can clear: the
   * content script had not been injected in the frame yet, the message port
   * closed before the reply, or the frame was replaced while the command was in
   * flight.
   *
   * Distinct from ACTION_FAILED, which it used to be reported as, because
   * ACTION_FAILED means "the verb ran and failed for a reason no code names" and
   * this means the verb was never reached. Both are retryable, so the difference
   * buys no retry -- it buys a diagnosis that says where to look, which is the
   * difference between a repair that changes the Flow and one that waits.
   */
  TRANSPORT_TRANSIENT: "web.transport.transient",
  /** The client does not implement the requested action type at all. */
  UNSUPPORTED_TYPE: "web.action.unsupported_type",
  /** The verb is registered but not built yet, so a Flow that reaches one fails honestly. */
  NOT_IMPLEMENTED: "web.action.not_implemented",
  /**
   * A field the action requires arrived in a shape that cannot be read, so the
   * command was refused before dispatch. `client/gateway-mapping.ts` decides it
   * from what `client/gateway-action-parameters.ts` refused. The Flow's node is
   * authored wrong and only an edit fixes it: a structural fault in the Flow,
   * not a capability the client lacks.
   */
  INVALID_PARAMETER: "web.action.invalid_parameter",
  /** The action ran and failed for a reason no other code names. */
  ACTION_FAILED: "web.action.failed",
  /** Nothing said why the action failed. */
  UNKNOWN: "web.action.unknown"
} as const);

/** One of the closed set's codes, as it appears in a failure record. */
export type WebAutomationFailureCode = (typeof WEB_AUTOMATION_FAILURE_CODES)[keyof typeof WEB_AUTOMATION_FAILURE_CODES];

/**
 * Core's failure record with `code` narrowed to the closed set: the record the
 * browser path produces, as opposed to the record Core accepts.
 *
 * Core declares `code` as a bare `string` on purpose -- it owns the categories
 * and the producer owns the vocabulary of codes -- so the set has to be
 * re-established on this side or it is not enforced anywhere. Without this
 * type, `webAutomationFailureRecord` checked its argument against the set and
 * then returned a record whose `code` was `string` again, throwing the check
 * away one line after making it, and a record written by hand at a call site
 * compiled with any string at all. That is how out-of-set codes kept reaching
 * the wire while every gate passed.
 *
 * It stays assignable to `AutomationStudioFailureRecord`, so nothing that only
 * needs Core's shape has to know this type exists.
 */
export type WebAutomationFailureRecord = Omit<AutomationStudioFailureRecord, "code"> & { code: WebAutomationFailureCode };

/**
 * What a code always means: its Core category, whether retrying it unchanged
 * can work, where it was decided, and -- on the rows whose producer can prove
 * it -- that the act did not happen.
 */
export type WebAutomationFailureCodeDefinition = {
  readonly category: AutomationStudioAdaptiveFailureClass;
  readonly retryable: boolean;
  readonly stage: AutomationStudioFailureStage;
  readonly effect?: NonNullable<AutomationStudioFailureRecord["effect"]>;
};

/**
 * The longest wait a record may carry: Core's
 * `AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS.retryAfterMsMax`, restated as a
 * number for the reason `WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH` is -- the
 * content script must not import Core's runtime, and Core's parser drops a
 * record whose wait exceeds it. `tests/codes.test.ts` asserts the two agree.
 */
export const WEB_AUTOMATION_RETRY_AFTER_MAX_MS = 3_600_000;

/**
 * The code table. Each row is fixed, which is what lets a producer name a code
 * and nothing else.
 *
 * The stage vocabulary, applied consistently: `target_resolution` while
 * deciding which element to act on; `dispatch` before anything ran, for a verb
 * the client will not run at all; `execution` while the action ran;
 * `confirmation` while confirming the action itself landed; `verification`
 * while checking a post-condition or an authored assertion.
 *
 * `retryable` answers only Core's question -- whether retrying the same action
 * unchanged can succeed without a person or a Flow edit. Core forbids six
 * categories from ever being retryable, so those rows have no choice; the rest
 * are judged: a target that could not be found may appear once the page
 * settles, whereas an ambiguous one stays ambiguous until the Flow says which
 * it meant.
 */
export const WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS: Readonly<Record<WebAutomationFailureCode, WebAutomationFailureCodeDefinition>> = Object.freeze({
  "web.action.rejected": { category: "blocked_by_capability_or_policy", retryable: false, stage: "execution" },
  "web.target.not_actionable": { category: "unexpected_state", retryable: false, stage: "execution" },
  "web.target.not_found": { category: "target_not_found", retryable: true, stage: "target_resolution" },
  "web.target.ambiguous": { category: "target_ambiguous", retryable: false, stage: "target_resolution" },
  "web.validation.output_not_observed": { category: "output_not_observed", retryable: true, stage: "verification" },
  "web.validation.state_mismatch": { category: "unexpected_state", retryable: false, stage: "verification" },
  "web.navigation.unexpected": { category: "navigation_unexpected", retryable: false, stage: "confirmation" },
  "web.page.changed": { category: "page_changed", retryable: true, stage: "execution" },
  "web.action.timeout": { category: "timeout", retryable: true, stage: "execution" },
  "web.auth.required": { category: "auth_required", retryable: false, stage: "confirmation" },
  "web.intervention.required": { category: "user_intervention_required", retryable: false, stage: "execution" },
  "web.action.blocked_by_dialog": { category: "unexpected_state", retryable: false, stage: "execution" },
  // The page's own notice says the press confirmed nothing, so the act did not
  // happen and making it again after the named wait is not a second act.
  "web.action.rate_limited": { category: "action_failed", retryable: true, stage: "execution", effect: "unacted" },
  // The page said it needs something first and did nothing: its state, which
  // answers the same press the same way until something else on it changes.
  "web.action.refused_by_page": { category: "unexpected_state", retryable: false, stage: "execution", effect: "unacted" },
  // A page this extension may not touch answers the same way however many times
  // it is asked, so the row says so: `dispatch`, because the browser refused
  // before the verb was reached, and not retryable.
  "web.browser.permission_denied": { category: "blocked_by_capability_or_policy", retryable: false, stage: "dispatch" },
  // The verb was never reached and the next attempt may reach it.
  "web.transport.transient": { category: "action_failed", retryable: true, stage: "execution" },
  "web.action.unsupported_type": { category: "blocked_by_capability_or_policy", retryable: false, stage: "dispatch" },
  "web.action.not_implemented": { category: "blocked_by_capability_or_policy", retryable: false, stage: "dispatch" },
  "web.action.invalid_parameter": { category: "graph_validation_or_unknown_node", retryable: false, stage: "dispatch" },
  "web.action.failed": { category: "action_failed", retryable: true, stage: "execution" },
  "web.action.unknown": { category: "ambiguous_or_unknown", retryable: false, stage: "execution" }
});

/** The short descriptions a record may carry, and the digest of the evidence packet captured with it. */
export type WebAutomationFailureComparison = {
  /** What was expected, in words. Never raw page content, credentials, or recorded data. */
  expected?: string | undefined;
  /** What was observed instead, under the same rule as `expected`. */
  actual?: string | undefined;
  /** Lowercase SHA-256 hex digest of the failure-evidence packet. */
  evidenceDigest?: string | undefined;
  /** The wait the page asked for before the same act is made again, in milliseconds. Kept only on a retryable code. */
  retryAfterMs?: number | undefined;
};

/** True when a string is one of the closed set's codes. */
export function isWebAutomationFailureCode(value: unknown): value is WebAutomationFailureCode {
  return typeof value === "string" && Object.hasOwn(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS, value);
}

/**
 * The Core failure record for a code. The category, retryable flag and stage
 * come from the table, so the caller decides only which failure happened and
 * what it can say about it.
 *
 * Text is collapsed to one line and bounded to Core's own record limit, and a
 * description that collapses to nothing is dropped rather than passed on: the
 * parser rejects an empty string, and an unbounded one would take the whole
 * record with it. A digest that is not a lowercase SHA-256 hex string is
 * dropped for the same reason -- losing one optional field beats losing the
 * failure. So is a wait on a code that is not retryable, which Core's parser
 * calls a contradiction; a readable wait is rounded to whole milliseconds and
 * held to Core's bound instead. The effect is the row's, never the caller's.
 */
export function webAutomationFailureRecord(code: WebAutomationFailureCode, comparison: WebAutomationFailureComparison = {}): WebAutomationFailureRecord {
  const definition = WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code];
  const expected = boundedText(comparison.expected);
  const actual = boundedText(comparison.actual);
  const evidenceDigest = comparison.evidenceDigest !== undefined && EVIDENCE_DIGEST_PATTERN.test(comparison.evidenceDigest) ? comparison.evidenceDigest : undefined;
  const retryAfterMs = definition.retryable ? boundedWait(comparison.retryAfterMs) : undefined;
  return {
    category: definition.category,
    code,
    retryable: definition.retryable,
    stage: definition.stage,
    ...(expected === undefined ? {} : { expected }),
    ...(actual === undefined ? {} : { actual }),
    ...(evidenceDigest === undefined ? {} : { evidenceDigest }),
    ...(definition.effect === undefined ? {} : { effect: definition.effect }),
    ...(retryAfterMs === undefined ? {} : { retryAfterMs })
  };
}

const EVIDENCE_DIGEST_PATTERN = /^[a-f0-9]{64}$/u;

function boundedWait(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.min(Math.round(value), WEB_AUTOMATION_RETRY_AFTER_MAX_MS);
}

function boundedText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (collapsed.length === 0) return undefined;
  if (collapsed.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}…`;
}
