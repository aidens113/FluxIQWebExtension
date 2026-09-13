// Which of the two element descriptions the resolver acts on.
//
// A command carries the recorded element twice: `action.element`, the field the
// domain declares and the compiler knows about, and `action.options.element`,
// the same value inside the untyped parameter bag. Wave 3 added the first and
// left the resolver reading only the second, which made the declared field
// write-only -- populated, tested at the domain end, and consumed by nothing.
// That is worse than not having it: the untyped path was meant to be removable
// once the declared one was live, and removing it while the resolver still read
// it would have destroyed target resolution with `tsc` reporting nothing, since
// no type describes `options.element` at all.
//
// So these rows are the consumer half of that contract. The first fails the
// moment `recordedTarget()` stops reading `action.element`; the second fails the
// moment the fallback is dropped while a caller still sends only `options`. They
// are deliberately a pair: each is the other's guard, and together they say
// exactly when the untyped path may be deleted -- when no producer sends it.
//
// The DOM is a stub because the extension's unit runner is Node. What is under
// test is the choice of description, not the lookup: each description names a
// different element by selector, so which element comes back names which
// description was read. Resolution against a real page is covered by
// `e2e/content/tests/resolve-target.spec.ts`.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { resolveTarget } from "../resolve-target";
import type { BrowserActionCommand } from "../../types";

/** The element the *declared* field points at: what Core dispatched. */
const ADAPTED_SELECTOR = "#save-adapted";
/** The element the *untyped bag* points at: what the recording captured. */
const RECORDED_SELECTOR = "#save-recorded";

/**
 * An element that answers everything the resolver's visibility and enabled
 * gates ask, so a match survives to be returned rather than surviving only
 * because the gate rejected every candidate.
 */
class StubElement {
  readonly isConnected = true;
  readonly textContent = "Save changes";
  readonly ownerDocument = {
    defaultView: { getComputedStyle: () => ({ display: "block", visibility: "visible" }) }
  };

  constructor(readonly tagName: string, readonly id: string) {}

  getBoundingClientRect(): { width: number; height: number } {
    return { width: 120, height: 32 };
  }

  /** Only ever asked `:disabled` here, and this element is not. */
  matches(): boolean {
    return false;
  }

  /** Only ever asked for an `aria-disabled` ancestor, and there is none. */
  closest(): Element | null {
    return null;
  }
}

function stub(id: string): Element {
  return new StubElement("BUTTON", id) as unknown as Element;
}

/**
 * A page holding both elements, addressable by the selectors the two
 * descriptions carry. `querySelectorAll` answers empty: no strategy in these
 * rows reaches it, and an empty answer makes that visible if one ever does.
 *
 * The runner imports every test bundle into one Node process, so a `document`
 * left on the global outnumbers this file: `content/evidence/interactions.ts`
 * installs its listeners at load behind `typeof document !== "undefined"`, and
 * a stub without `addEventListener` turns that guard into a crash in whichever
 * bundle loads next. So the stub answers it, and the previous global -- usually
 * none -- is put back when the test ends.
 */
function installPage(t: TestContext): { adapted: Element; recorded: Element } {
  const adapted = stub("save-adapted");
  const recorded = stub("save-recorded");
  const bySelector: Record<string, Element> = { [ADAPTED_SELECTOR]: adapted, [RECORDED_SELECTOR]: recorded };
  const page = {
    querySelector: (selector: string): Element | null => bySelector[selector] ?? null,
    querySelectorAll: (): Element[] => [],
    getElementById: (): Element | null => null,
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
    activeElement: null
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { value: page, configurable: true, writable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else delete (globalThis as { document?: unknown }).document;
  });
  return { adapted, recorded };
}

function clickCommand(fields: Partial<BrowserActionCommand>): BrowserActionCommand {
  return { commandId: "cmd-1", actionType: "web.dom.click", ...fields } as BrowserActionCommand;
}

test("the declared element field is what resolves, not the untyped options blob", (t) => {
  const { adapted, recorded } = installPage(t);

  const resolved = resolveTarget(clickCommand({
    element: { selector: ADAPTED_SELECTOR },
    options: { element: { selector: RECORDED_SELECTOR } }
  }));

  assert.equal(resolved.element, adapted, "the resolver must read action.element, the declared contract");
  assert.notEqual(resolved.element, recorded);
  assert.equal(resolved.resolution.strategy, "fingerprint");
});

test("the untyped options blob still resolves while it is the only description sent", (t) => {
  const { recorded } = installPage(t);

  const resolved = resolveTarget(clickCommand({
    options: { element: { selector: RECORDED_SELECTOR } }
  }));

  assert.equal(resolved.element, recorded, "the fallback must stay live until no producer sends only options");
  assert.equal(resolved.resolution.strategy, "fingerprint");
});

// An exact strategy reports what it did and nothing it did not measure. The
// scores are absent here on purpose: this resolution came from a lookup, not
// from scoring, and a confidence invented for it would be a constant dressed as
// a measurement, which is the one thing D1 forbids. What a Flow reads instead is
// the strategy -- `fingerprint` with one candidate is an exact answer and
// `scored-candidate` with four is a judgement, and those earn different amounts
// of trust.
test("an exact resolution reports the strategy that answered and claims no score", (t) => {
  installPage(t);

  const resolved = resolveTarget(clickCommand({ element: { selector: ADAPTED_SELECTOR } }));

  assert.deepEqual(resolved.resolution, { strategy: "fingerprint", candidateCount: 1 });
});

test("a declared field with no identity in it falls back rather than blanking the target", (t) => {
  const { recorded } = installPage(t);

  const resolved = resolveTarget(clickCommand({
    element: {},
    options: { element: { selector: RECORDED_SELECTOR } }
  }));

  assert.equal(resolved.element, recorded);
});

test("neither description leaves the resolver with no target at all", (t) => {
  installPage(t);

  assert.throws(
    () => resolveTarget(clickCommand({})),
    /No selector, coordinates, or active element was available\./
  );
});

// What a not-found failure says about the page, and the difference between
// "there is no such control here" and "we stopped looking before we got there".
//
// `collectTargetCandidates` walks the page's interactive elements in document
// order and keeps the ones in the recorded target's tag-or-role family. The
// walk is bounded, and the bound used to be 600 elements spent on *every*
// interactive element rather than on family members -- so a page with a long
// nav and a long grid ahead of its content had the budget gone before the
// family began. The pool came back empty and the failure record read
// "nothing matched; 0 control(s) of the same family are on the page", which is
// a statement about the page and was false: nothing had looked at the part of
// the page the control was in.
//
// The two rows below are the pair. Both end in TARGET_NOT_FOUND with an empty
// pool; only one of them is entitled to say the page holds no such control.
// The DOM is a stub for the reason the rows above give -- the runner is Node --
// and it is exactly as thin as the family filter is: `inFamily` compares
// `tagName` and, only when the recorded family names a role, reads one
// attribute. A page of anchors against a recorded `button` never reaches the
// second, so an element here is `{ tagName: "A" }` and nothing more.
// `e2e/content/tests/large-page-resolution.spec.ts` runs the same two shapes
// against a real Chromium page with the real bundle.

/** The scan bound in `identity/candidates.ts`. Kept here so a page can be built either side of it. */
const SCAN_BOUND = 5_000;

function anchors(count: number): Element[] {
  return Array.from({ length: count }, () => ({ tagName: "A" }) as unknown as Element);
}

/**
 * A page holding `interactive` interactive elements, none of them in the
 * recorded family, and nothing any exact strategy can answer.
 *
 * Only the candidate sweep gets the list: every other `querySelectorAll` here
 * belongs to a strategy that must miss, and answering it with the sweep's list
 * would resolve one of these stubs instead of failing.
 */
function installCrowdedPage(t: TestContext, interactive: number): void {
  const pool = anchors(interactive);
  const page = {
    querySelector: (): Element | null => null,
    querySelectorAll: (selector: string): Element[] => (selector.includes("[contenteditable]") ? pool : []),
    getElementById: (): Element | null => null,
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
    activeElement: null
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { value: page, configurable: true, writable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else delete (globalThis as { document?: unknown }).document;
  });
}

/** The failure record `resolveTarget` threw, or a failed assertion if it resolved something. */
function failureOf(command: BrowserActionCommand): { code: string; actual?: string | undefined } {
  try {
    resolveTarget(command);
  } catch (error) {
    const failure = (error as { failure?: { code: string; actual?: string } }).failure;
    assert.ok(failure, "the resolution error carried no failure record");
    return failure;
  }
  assert.fail("the resolution was expected to fail");
}

/** A recorded button no strategy can find, so enumeration decides what the failure says. */
const MISSING_BUTTON: BrowserActionCommand = {
  commandId: "missing-button",
  actionType: "web.dom.click",
  selector: "#gone",
  element: { selector: "#gone", tagName: "button", id: "save-order" }
} as BrowserActionCommand;

test("a page whose family the scan never reached says the scan was cut short, not that the page is empty", (t) => {
  installCrowdedPage(t, SCAN_BOUND + 1_000);

  const failure = failureOf(MISSING_BUTTON);

  assert.equal(failure.code, "web.target.not_found");
  // The count is still reported -- a Flow reads it -- but as a floor over the
  // part of the page that was looked at, with where the looking stopped.
  assert.match(failure.actual ?? "", /0 control\(s\) of the same family in the first 5000 interactive element\(s\)/u);
  assert.match(failure.actual ?? "", /cut short/u);
  // And it must not make the claim it used to: that the page holds none.
  assert.doesNotMatch(failure.actual ?? "", /are on the page/u);
});

test("a page the scan read to the end still says plainly that no such control is on it", (t) => {
  installCrowdedPage(t, 100);

  const failure = failureOf(MISSING_BUTTON);

  assert.equal(failure.code, "web.target.not_found");
  assert.equal(failure.actual, "nothing matched; 0 control(s) of the same family are on the page");
});

// CS1d: a point is not a choice between twins.
//
// `coordinates` and `visual-target` resolve through `elementFromPoint`, which
// answers with one element whatever else the page holds, so a point strategy's
// pool always has one member and a byte-identical twin never shows in it. On
// `ambiguous-targets` `no-context` the recorded bounds landed on the first of
// two identical Continue buttons and the replay clicked it (`L-replay` Defect
// 1). The resolver now scores the recorded target's family before acting on a
// point, and a family that scoring calls tied is TARGET_AMBIGUOUS.
//
// The page is a stub, because the runner is Node. It answers what this path
// reads -- a point, the candidate sweep, the gate's style and box, the signals
// `candidateFingerprint` asks a button for -- and installs the platform classes
// the identity modules test with `instanceof`, as empty classes no stub belongs
// to. `identity-resolution.spec.ts` runs the same shape on the real fixture.

/** A `<button class="ui-button">Continue</button>`, as far as resolution reads one. */
class TwinButton {
  readonly tagName = "BUTTON";
  readonly id = "";
  readonly classList = ["ui-button"];
  readonly textContent = "Continue";
  readonly isConnected = true;
  readonly ownerDocument = { defaultView: { getComputedStyle: () => ({ display: "block", visibility: "visible" }) } };

  constructor(readonly top: number) {}

  getAttribute(name: string): string | null {
    return name === "class" ? "ui-button" : null;
  }

  hasAttribute(): boolean {
    return false;
  }

  getBoundingClientRect(): { x: number; y: number; top: number; bottom: number; width: number; height: number } {
    return { x: 100, y: this.top, top: this.top, bottom: this.top + 32, width: 120, height: 32 };
  }

  /** Asked only `:disabled`, and a twin is not. */
  matches(): boolean {
    return false;
  }

  /** Asked only for an ancestor, and a twin has none. */
  closest(): Element | null {
    return null;
  }

  /** A twin holds nothing but its text. */
  querySelectorAll(): Element[] {
    return [];
  }
}

/** A page of `count` identical Continue buttons with the first under every point, its globals restored when the test ends. */
function installTwinPage(t: TestContext, count: number): Element[] {
  const buttons = Array.from({ length: count }, (_, index) => new TwinButton(100 + index * 40) as unknown as Element);
  const installed: Record<string, unknown> = {
    document: {
      elementFromPoint: (): Element | null => buttons[0] ?? null,
      querySelector: (): Element | null => null,
      querySelectorAll: (selector: string): Element[] => (selector === "button" || selector.includes("[contenteditable]") ? buttons : []),
      getElementById: (): Element | null => null,
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
      activeElement: null
    },
    window: { innerHeight: 720, scrollX: 0, scrollY: 0, addEventListener: (): void => {}, removeEventListener: (): void => {} },
    HTMLElement: class {},
    HTMLInputElement: class {},
    HTMLSelectElement: class {},
    HTMLTextAreaElement: class {}
  };
  for (const [name, value] of Object.entries(installed)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete (globalThis as Record<string, unknown>)[name];
    });
  }
  return buttons;
}

/** The primary Continue as the baseline page recorded it: the test id that told the twins apart, and their shared label. */
const RECORDED_CONTINUE = {
  tagName: "button", implicitRole: "button", testId: "choice-primary", selector: '[data-testid="choice-primary"]',
  visibleText: "Continue", accessibleName: "Continue"
};

/** The Flow's shape: the recorded selector, gone from this page, then a point. */
function pointCommand(point: Record<string, unknown>): BrowserActionCommand {
  return clickCommand({ selector: RECORDED_CONTINUE.selector, ...point, element: RECORDED_CONTINUE } as Partial<BrowserActionCommand>);
}

const POINTS = [
  { strategy: "coordinates", fields: { coordinates: { x: 160, y: 116 } } },
  { strategy: "visual target", fields: { visualTarget: { namespace: "web", statePath: "recorded.continue", documentBounds: { x: 100, y: 100, width: 120, height: 32 } } } }
];

for (const point of POINTS) {
  test(`a point on one of two identical twins fails TARGET_AMBIGUOUS instead of clicking it: ${point.strategy}`, (t) => {
    installTwinPage(t, 2);

    let thrown: unknown;
    try {
      resolveTarget(pointCommand(point.fields));
    } catch (error) {
      thrown = error;
    }

    const failed = thrown as { failure?: { code: string; expected?: string }; resolution?: { strategy: string; candidateCount: number; bestScore?: number; runnerUpScore?: number } } | undefined;
    assert.ok(failed?.failure, "the point resolved one of the twins instead of failing");
    assert.equal(failed.failure.code, "web.target.ambiguous");
    // The point did land -- it is named among what was tried -- and scoring decided.
    assert.match(failed.failure.expected ?? "", new RegExp(point.strategy, "u"));
    assert.equal(failed.resolution?.strategy, "scored-candidate");
    assert.equal(failed.resolution?.candidateCount, 2);
    assert.equal(failed.resolution?.bestScore, failed.resolution?.runnerUpScore);
  });
}

test("a point on a control with no twin still resolves by the point", (t) => {
  const [only] = installTwinPage(t, 1);

  const resolved = resolveTarget(pointCommand(POINTS[0]!.fields));

  assert.equal(resolved.element, only);
  assert.equal(resolved.resolution.strategy, "coordinates");
});
