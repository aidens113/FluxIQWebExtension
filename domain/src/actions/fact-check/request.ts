// What a fact check asks the page (plan B1): a batch of claims, each already a
// literal, answered in one round trip with no wait.
//
// A fact check is a host query, not a Flow step. It is not one of
// `WEB_AUTOMATION_ACTION_TYPES`, so it has no output node, no catalog entry, no
// schema a model can author and no chat card; it travels the gateway's
// `execute_action` channel under its own action type, which only the domain's
// fact evaluator (`runtime/facts/`) sends and only the extension's fact route
// (`runtime/fact-check-runner.ts`) answers. The extension intercepts it before
// `normalizeWebAutomationActionType`, which would refuse it as unsupported.
//
// Every binding is resolved before this shape is built: a Flow input or a
// bound value Core supplied becomes the `expected` literal here, and a
// condition whose binding is missing is answered `unknown` by the domain
// without being sent. So the page compares; it never looks anything up.

import type { WebAutomationElementFingerprint } from "../types";
import type { WebAutomationLayerKind } from "../../page-evidence";

/** The gateway action type a fact check travels under. Never a Flow output. */
export const WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE = "web.page.facts";

/** How a text, address or field value is compared with the expected literal. `matches` is a regular expression. */
export type WebAutomationFactComparison = "equals" | "contains" | "matches";

/** How a count of matching elements is compared with the expected number. */
export type WebAutomationFactCountComparison = "=" | "!=" | ">" | ">=" | "<" | "<=";

/**
 * The element a claim is about. `selector` alone is re-queried as
 * `web.dom.assert` re-queries it; with `element` the page resolves it as an
 * action's target is resolved (`content/action-runtime/resolve-target.ts`).
 * `shadowHosts` is the recorded host chain of a selector written inside a
 * shadow root.
 */
export type WebAutomationFactTarget = {
  selector?: string | undefined;
  element?: WebAutomationElementFingerprint | undefined;
  shadowHosts?: string[] | undefined;
};

/** A claim that an element is, or is not, in a state: `exists` false is "absent". */
export type WebAutomationFactStateQuery = {
  kind: "exists" | "visible" | "enabled" | "checked" | "selected";
  target: WebAutomationFactTarget;
  expected: boolean;
};

export type WebAutomationFactTextQuery = {
  kind: "text";
  /** Absent, the claim is about the page's whole text. */
  target?: WebAutomationFactTarget | undefined;
  comparison: WebAutomationFactComparison;
  expected: string;
};

export type WebAutomationFactUrlQuery = { kind: "url"; comparison: WebAutomationFactComparison; expected: string };

/** A field's value. A sensitive control is never read: its claim is answered `unknown`. */
export type WebAutomationFactValueQuery = {
  kind: "value";
  target: WebAutomationFactTarget;
  comparison: WebAutomationFactComparison;
  expected: string;
};

/** How many elements the selector matches. */
export type WebAutomationFactCountQuery = {
  kind: "count";
  target: WebAutomationFactTarget & { selector: string };
  comparison: WebAutomationFactCountComparison;
  expected: number;
};

/**
 * Whether a dialog is open, optionally of one page-evidence `kind` and with an
 * accessible name containing `nameContains`. A dialog the classifiers could not
 * name may be of any kind, so it makes a claim about a kind `unknown`.
 */
export type WebAutomationFactDialogQuery = {
  kind: "dialog";
  dialogKind?: WebAutomationLayerKind | undefined;
  nameContains?: string | undefined;
  expected: boolean;
};

/**
 * One claim, and the frame it is about: absent, the top document. The
 * extension asks each frame named in a batch once, with that frame's claims,
 * so a batch is still one gateway round trip however many frames it names.
 */
export type WebAutomationFactQuery = (
  | WebAutomationFactStateQuery
  | WebAutomationFactTextQuery
  | WebAutomationFactUrlQuery
  | WebAutomationFactValueQuery
  | WebAutomationFactCountQuery
  | WebAutomationFactDialogQuery
) & { frameId?: number | undefined };

export type WebAutomationFactQueryKind = WebAutomationFactQuery["kind"];

/**
 * The batch, as the gateway command's parameters carry it. `documentTimeOrigin`
 * is the identity of the document the asker last saw (a state snapshot's
 * `documentTimeOrigin`); a page now holding another document answers every
 * claim `unknown`, because it was asked about a page that is gone.
 */
export type WebAutomationFactCheckRequest = {
  queries: WebAutomationFactQuery[];
  documentTimeOrigin?: number | undefined;
};
