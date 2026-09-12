// The page evidence written into the `web` namespace, item by item.
//
// Three rules decide what lands and where.
//
// **The path mirrors the evidence.** Every path is `evidence.` followed by the
// field's own path inside the browser's `PageEvidence`, so a reader who knows
// that shape already knows every path. The prefix is not decoration: `elements`
// is the element namespace, whose reserved keys are declared in
// `element/selection.ts`, and writing `elements.scanned` would let a page
// shipping `data-testid="scanned"` overwrite a count. Two paths depart from the
// mirror and say so where they are written.
//
// **A collection is one value, not a path per item.** `state-values.ts` files a
// whole element as one JSON blob because consumers read the blob and a path per
// field multiplies the snapshot; the same holds here. Each collection is
// written as `{ count, truncated, items }` -- the pre-cap total, whether the cap
// bit, and what survived -- which is the `matched`/`returned`/`truncated`
// convention the evidence and `elements.*` already use, not a fourth one.
//
// **Bounded, always.** State is built on every recorded event and the sanitized
// packet downstream has a byte budget, so every collection has a cap and every
// string a length. The caps are at or below the producer's, so a healthy
// pipeline loses nothing here and a regression upstream cannot make the
// projection unbounded. Trimming is a plain slice in declaration order: the
// same snapshot trims the same way twice.

import type { StateSnapshot, StateValue, StateValueType } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { isSensitiveFieldSignature } from "../../../sensitivity";
import { compactJsonObject } from "../compact-json-object";
import { putStateValue } from "../state-values";
import type { WebAutomationPageEvidenceInput } from "./input";
import { count, flag, isPresent, list, record, rect, text } from "./read";

/** Every evidence path starts here, so nothing collides with `elements.*`. */
const EVIDENCE_PATH_PREFIX = "evidence.";

// Each cap is the point past which more of the same item stops telling a reader
// anything new, and each is at or below the producer's own.
const MAX_DIALOGS = 5;
const MAX_OVERLAY_BLOCKERS = 5;
const MAX_BLOCKED_SELECTORS = 5;
const MAX_LOADING_INDICATORS = 8;
const MAX_BUSY_REGIONS = 8;
const MAX_REGIONS = 20;
const MAX_REPEATING = 8;
const MAX_REPEATING_FIELDS = 8;
const MAX_FORMS = 8;
const MAX_FORM_CONTROLS = 20;

/** Every evidence item this snapshot offered, written under `evidence.*`. */
export function addPageEvidenceStateValues(
  state: StateSnapshot,
  evidence: WebAutomationPageEvidenceInput,
  timestamp: number,
  sourceId: string | undefined
): StateSnapshot {
  let next = state;
  const put: PutStateValue = (path, type, value, input = {}) => {
    next = putStateValue(next, `${EVIDENCE_PATH_PREFIX}${path}`, type, value, timestamp, sourceId, input);
  };
  addElementTotals(put, record(evidence.elements));
  addLoading(put, record(evidence.loading));
  addNavigation(put, record(evidence.navigation));
  addDialogs(put, record(evidence.dialogs));
  addOverlays(put, record(evidence.overlays));
  addRegions(put, list(evidence.regions));
  addRepeating(put, list(evidence.repeating));
  addForms(put, list(evidence.forms));
  return next;
}

type EvidenceValueInput = Partial<StateValue> & { elementKind?: string; stableAcrossSessions?: boolean };
type PutStateValue = (path: string, type: StateValueType, value: unknown, input?: EvidenceValueInput) => void;

const COUNT: EvidenceValueInput = { elementKind: "count" };
const LIVE_COUNT: EvidenceValueInput = { elementKind: "count", volatility: "rapid" };
const STATUS: EvidenceValueInput = { elementKind: "status" };
const LIVE_STATUS: EvidenceValueInput = { elementKind: "status", volatility: "rapid" };
// A collection is diagnostic, so it is never compared value-for-value: two
// captures of one page differ in every rect, and Core would read that as a
// state change on every event.
const COLLECTION: EvidenceValueInput = { elementKind: "collection", comparable: false };
const LIVE_COLLECTION: EvidenceValueInput = { ...COLLECTION, volatility: "rapid" };
const SETTLED_COLLECTION: EvidenceValueInput = { ...COLLECTION, volatility: "slow" };

// The funnel the browser walked, before the projection's own filter narrowed it
// again. `elements.count` and `elements.captured` are the domain end of the same
// funnel: scanned -> candidates -> matched -> returned == count -> captured.
function addElementTotals(put: PutStateValue, totals: Record<string, unknown> | undefined): void {
  if (!totals) return;
  putCount(put, "elements.scanned", totals.scanned, COUNT);
  putCount(put, "elements.candidates", totals.candidates, COUNT);
  putCount(put, "elements.matched", totals.matched, COUNT);
  putCount(put, "elements.returned", totals.returned, COUNT);
  putCount(put, "elements.changed", totals.changed, LIVE_COUNT);
  putCount(put, "elements.recentlyInteracted", totals.recentlyInteracted, LIVE_COUNT);
  putFlag(put, "elements.truncated", totals.truncated, STATUS);
}

function addLoading(put: PutStateValue, loading: Record<string, unknown> | undefined): void {
  if (!loading) return;
  putText(put, "loading.documentState", loading.documentState, LIVE_STATUS);
  putFlag(put, "loading.busy", loading.busy, LIVE_STATUS);
  putFlag(put, "loading.pendingNavigation", loading.pendingNavigation, LIVE_STATUS);
  putCollection(put, "loading.busyRegions", list(loading.busyRegions), MAX_BUSY_REGIONS, selectorItem, LIVE_COLLECTION);
  putCollection(put, "loading.indicators", list(loading.indicators), MAX_LOADING_INDICATORS, (item) => {
    const indicator = record(item);
    return compactJsonObject({
      selector: text(indicator?.selector),
      kind: text(indicator?.kind),
      label: text(indicator?.label)
    });
  }, LIVE_COLLECTION);
}

// `navigation.url` is deliberately absent: `page.url` already carries it, and a
// second copy of the page's URL is a value that can silently disagree with the
// first. `origin` and `path` are kept because they are the decompositions a
// check compares -- "did we land on the expected origin" -- and neither
// restates the whole.
function addNavigation(put: PutStateValue, navigation: Record<string, unknown> | undefined): void {
  if (!navigation) return;
  putText(put, "navigation.origin", navigation.origin, { elementKind: "url", volatility: "slow" });
  putText(put, "navigation.path", navigation.path, { elementKind: "route", volatility: "slow" });
  putText(put, "navigation.referrer", navigation.referrer, { elementKind: "url", volatility: "slow" });
  putText(put, "navigation.type", navigation.type, { elementKind: "status", volatility: "slow" });
  putCount(put, "navigation.redirects", navigation.redirects, COUNT);
  putCount(put, "navigation.historyLength", navigation.historyLength, COUNT);
  putText(put, "navigation.visibility", navigation.visibility, { elementKind: "visibility", volatility: "rapid" });
}

// `dialogs.openCount` is the second departure from the mirror, and the only
// derived value here. "Is anything standing in front of the page" is the
// question that decides whether an action may be attempted at all, and a check
// has to be able to compare it without reading a JSON blob.
function addDialogs(put: PutStateValue, dialogs: Record<string, unknown> | undefined): void {
  if (!dialogs) return;
  const open = list(dialogs.open);
  put("dialogs.openCount", "integer", open.length, LIVE_COUNT);
  putFlag(put, "dialogs.modal", dialogs.modal, LIVE_STATUS);
  putFlag(put, "dialogs.armPending", dialogs.armPending, LIVE_STATUS);
  putCollection(put, "dialogs.open", open, MAX_DIALOGS, (item) => {
    const dialog = record(item);
    return compactJsonObject({
      selector: text(dialog?.selector),
      role: text(dialog?.role),
      modal: flag(dialog?.modal),
      native: flag(dialog?.native),
      label: text(dialog?.label),
      bounds: rect(dialog?.bounds)
    });
  }, LIVE_COLLECTION);
  // The message a native dialog showed, and never `promptText`: what a person
  // typed into a `prompt` is a value, and the producer projects it out for that
  // reason. Naming the four fields kept holds that true whatever arrives.
  const native = record(dialogs.lastNative);
  if (native) {
    put("dialogs.lastNative", "json", compactJsonObject({
      kind: text(native.kind),
      message: text(native.message),
      response: text(native.response),
      at: count(native.at)
    }), { elementKind: "json", comparable: false, volatility: "rapid" });
  }
}

function addOverlays(put: PutStateValue, overlays: Record<string, unknown> | undefined): void {
  if (!overlays) return;
  putCount(put, "overlays.tested", overlays.tested, LIVE_COUNT);
  putCount(put, "overlays.blockedCount", overlays.blockedCount, LIVE_COUNT);
  putCollection(put, "overlays.blockers", list(overlays.blockers), MAX_OVERLAY_BLOCKERS, (item) => {
    const blocker = record(item);
    const blocked = list(blocker?.blocked);
    return compactJsonObject({
      selector: text(blocker?.selector),
      role: text(blocker?.role),
      label: text(blocker?.label),
      bounds: rect(blocker?.bounds),
      blocks: count(blocker?.blocks),
      blockedCount: blocked.length,
      blocked: blocked.slice(0, MAX_BLOCKED_SELECTORS).map(text).filter(isPresent)
    });
  }, LIVE_COLLECTION);
}

function addRegions(put: PutStateValue, regions: unknown[]): void {
  putCollection(put, "regions", regions, MAX_REGIONS, (item) => {
    const region = record(item);
    return compactJsonObject({
      role: text(region?.role),
      label: text(region?.label),
      selector: text(region?.selector),
      bounds: rect(region?.bounds)
    });
  }, SETTLED_COLLECTION);
}

function addRepeating(put: PutStateValue, repeating: unknown[]): void {
  putCollection(put, "repeating", repeating, MAX_REPEATING, (item) => {
    const structure = record(item);
    const representative = record(structure?.representative);
    return compactJsonObject({
      containerSelector: text(structure?.containerSelector),
      signature: text(structure?.signature),
      itemCount: count(structure?.itemCount),
      representative: representative
        ? compactJsonObject({
            selector: text(representative.selector),
            testId: text(representative.testId),
            text: text(representative.text)
          })
        : undefined,
      fields: list(structure?.fields).slice(0, MAX_REPEATING_FIELDS).map(text).filter(isPresent)
    });
  }, COLLECTION);
}

function addForms(put: PutStateValue, forms: unknown[]): void {
  putCollection(put, "forms", forms, MAX_FORMS, (item) => {
    const form = record(item);
    const controls = list(form?.controls);
    return compactJsonObject({
      selector: text(form?.selector),
      name: text(form?.name),
      label: text(form?.label),
      action: text(form?.action),
      method: text(form?.method),
      // The producer's own pre-cap total, kept beside the controls that
      // survived: the same count-plus-kept-list convention as everywhere else.
      controlCount: count(form?.controlCount) ?? controls.length,
      controls: controls.slice(0, MAX_FORM_CONTROLS).map(formControl),
      submit: text(form?.submit)
    });
  }, SETTLED_COLLECTION);
}

/**
 * One form control. Nothing here is a value, and `hasValue` is withheld from a
 * control the sensitivity rule marks: the flag is not the secret, but it is the
 * only field here derived from one at all, and a reader that already knows the
 * control is sensitive learns nothing from it worth carrying into a persisted,
 * replayed artefact.
 *
 * The rule is asked twice, and the two answers are independent. The producer's
 * `sensitive` flag is trusted when set, and the shared rule in
 * `domain/src/sensitivity/` is asked again here from the control's own signals,
 * so a control is protected even if the flag never arrives -- this is the far
 * side of a wire from the producer's guard, and `state-values.ts` takes the
 * same second look at an element's `value`. Both checks must fail before a
 * value escapes.
 *
 * That second look reads `autocomplete` as well as `controlType`, which is the
 * half of the rule that matters most: a card field is a plain `text` input
 * marked `billing cc-number`, so `controlType` alone can never see it, and that
 * exact token list has slipped past a copy of this rule twice in this plan. It
 * is read straight off the wire and never through `text()`, which collapses and
 * slices to 200 characters -- truncating the input to a security predicate is a
 * way past it. The attribute decides and is then discarded: it is not written
 * into state, because a persisted, replayed artefact gains nothing from it.
 */
function formControl(item: unknown): JsonObject {
  const control = record(item);
  const controlType = text(control?.controlType);
  const autocomplete = typeof control?.autocomplete === "string" ? control.autocomplete : undefined;
  const sensitive = control?.sensitive === true
    || isSensitiveFieldSignature({ inputType: controlType, controlType, autocomplete });
  return compactJsonObject({
    selector: text(control?.selector),
    controlType,
    name: text(control?.name),
    label: text(control?.label),
    required: flag(control?.required),
    disabled: flag(control?.disabled),
    hasValue: sensitive ? undefined : flag(control?.hasValue),
    sensitive: sensitive ? true : undefined
  });
}

function selectorItem(item: unknown): JsonObject {
  return compactJsonObject({ selector: text(item) });
}

// A collection with nothing in it is not written at all: state is built on
// every recorded event, and a page with no dialogs should cost nothing to say
// so. That is the producer's own rule for omitting an empty collection, kept.
function putCollection(
  put: PutStateValue,
  path: string,
  items: unknown[],
  cap: number,
  describe: (item: unknown) => JsonObject,
  input: EvidenceValueInput
): void {
  if (!items.length) return;
  put(path, "json", {
    count: items.length,
    truncated: items.length > cap,
    items: items.slice(0, cap).map(describe)
  }, input);
}

function putCount(put: PutStateValue, path: string, value: unknown, input: EvidenceValueInput): void {
  const total = count(value);
  if (total !== undefined) put(path, "integer", total, input);
}

function putFlag(put: PutStateValue, path: string, value: unknown, input: EvidenceValueInput): void {
  const state = flag(value);
  if (state !== undefined) put(path, "boolean", state, input);
}

function putText(put: PutStateValue, path: string, value: unknown, input: EvidenceValueInput): void {
  const bounded = text(value);
  if (bounded !== undefined) put(path, "string", bounded, input);
}
