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
import { resolveTargetWithDiagnostics } from "../resolve-target";
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

  const resolved = resolveTargetWithDiagnostics(clickCommand({
    element: { selector: ADAPTED_SELECTOR },
    options: { element: { selector: RECORDED_SELECTOR } }
  }));

  assert.equal(resolved.element, adapted, "the resolver must read action.element, the declared contract");
  assert.notEqual(resolved.element, recorded);
  assert.equal(resolved.resolution.strategy, "fingerprint");
});

test("the untyped options blob still resolves while it is the only description sent", (t) => {
  const { recorded } = installPage(t);

  const resolved = resolveTargetWithDiagnostics(clickCommand({
    options: { element: { selector: RECORDED_SELECTOR } }
  }));

  assert.equal(resolved.element, recorded, "the fallback must stay live until no producer sends only options");
  assert.equal(resolved.resolution.strategy, "fingerprint");
});

test("a declared field with no identity in it falls back rather than blanking the target", (t) => {
  const { recorded } = installPage(t);

  const resolved = resolveTargetWithDiagnostics(clickCommand({
    element: {},
    options: { element: { selector: RECORDED_SELECTOR } }
  }));

  assert.equal(resolved.element, recorded);
});

test("neither description leaves the resolver with no target at all", (t) => {
  installPage(t);

  assert.throws(
    () => resolveTargetWithDiagnostics(clickCommand({})),
    /No selector, coordinates, or active element was available\./
  );
});
