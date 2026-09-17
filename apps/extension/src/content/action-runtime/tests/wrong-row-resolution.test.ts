import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { resolveTarget } from "../resolve-target";
import type { BrowserActionCommand } from "../../types";

// A positional selector that resolves, and resolves to somebody else.
//
// This is the wrong-row defect end to end (`reports/w2-wrong-row-acted-on.md`).
// The member directory renders 240 rows whose action buttons are identical by
// design -- no id, no test id, one generated class, and the design system's
// constant `aria-label="Row actions"` -- so `selector/` can only name one of
// them by where it is: `[data-testid="member-rows"] > tr:nth-of-type(92) >
// td:nth-of-type(7) > button`. Replay that against a page the recorded member
// has left and the selector still matches exactly one element. It is another
// member's button, every signal agrees with the recording exactly, and before
// `identity/record.ts` the veto accepted it: the Flow promoted the wrong person
// and reported success.
//
// So the row below asserts a *refusal*. The recorded row's key is what the
// selector's answer is checked against, and a step that cannot find its record
// fails with a target failure the automation loop can act on, instead of acting
// on a record nobody asked about. The scored fallback's half of the same rule
// is in `identity/tests/record-veto.test.ts` and the rule itself is in
// `identity/tests/record.test.ts`; the candidate sweep here answers empty, so
// what this file measures is the exact path, end to end through the resolver.

// The refusal names the element it refused, and `identity/reportable-text.ts`
// narrows `instanceof HTMLInputElement` on the way. That is a ReferenceError
// under Node, so a stand-in stands on the global: no stub here is one, and only
// the lookup has to exist.
(globalThis as Record<string, unknown>).HTMLInputElement ??= class {};
(globalThis as Record<string, unknown>).HTMLSelectElement ??= class {};
(globalThis as Record<string, unknown>).HTMLTextAreaElement ??= class {};
(globalThis as Record<string, unknown>).HTMLElement ??= class {};
// `candidateFingerprint` measures a candidate against the viewport, which only
// the accepting half of the row below reaches.
(globalThis as Record<string, unknown>).window ??= { innerHeight: 800 };

/** The recorded selector: a position in the table, which is all the page offered. */
const ROW_SELECTOR = '[data-testid="member-rows"] > tr:nth-of-type(92) > td:nth-of-type(7) > button';

/** A row action button inside a row keyed by `memberId`, answering what resolution asks of it. */
function rowAction(memberId: string): Element {
  const row = {
    localName: "tr", tagName: "TR", parentElement: null,
    getAttribute: (name: string) => (name === "data-member-id" ? memberId : null),
    getAttributeNames: () => ["data-member-id", "class"],
    matches: (selector: string) => selector.includes("tr"),
    children: [], childNodes: []
  };
  const cell = { localName: "td", tagName: "TD", parentElement: row, matches: () => false, getAttributeNames: (): string[] => [], getAttribute: () => null, children: [], childNodes: [] };
  return {
    localName: "button",
    tagName: "BUTTON",
    parentElement: cell,
    isConnected: true,
    id: "",
    classList: ["x1f4a"],
    textContent: "Row actions",
    ownerDocument: { defaultView: { getComputedStyle: () => ({ display: "block", visibility: "visible" }) } },
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 24, height: 24, top: 10, bottom: 34 }),
    getAttribute: () => null,
    getAttributeNames: (): string[] => [],
    matches: (selector: string) => selector.includes("button"),
    closest: () => null,
    querySelectorAll: (): Element[] => [],
    children: [],
    childNodes: []
  } as unknown as Element;
}

/** The page after the recorded member left: the recorded position now holds another member's row. */
function installDirectoryPage(t: TestContext): Element {
  const occupant = rowAction("usr_b17");
  const page = {
    querySelector: (selector: string): Element | null => (selector === ROW_SELECTOR ? occupant : null),
    querySelectorAll: (selector: string): Element[] => (selector === ROW_SELECTOR ? [occupant] : []),
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
  return occupant;
}

/** The recorded step, as the Flow node carries it: the position, the identity, and the row it belonged to. */
function recordedRowAction(): BrowserActionCommand {
  return {
    commandId: "cmd-row",
    actionType: "web.dom.click",
    selector: ROW_SELECTOR,
    element: {
      selector: ROW_SELECTOR, tagName: "button", role: "button", implicitRole: "button",
      classNames: ["x1f4a"], accessibleName: "Row actions", visibleText: "Row actions",
      context: { tablePosition: { row: 92, column: 7 }, record: { keyAttribute: "data-member-id", key: "usr_a91" } }
    }
  } as BrowserActionCommand;
}

test("a positional selector that lands in another record fails the step instead of acting on it", (t) => {
  const occupant = installDirectoryPage(t);

  assert.throws(() => resolveTarget(recordedRowAction()), (error: unknown) => {
    const failure = (error as { failure?: { code?: string } }).failure;
    assert.equal(failure?.code, "web.target.not_found", "the step must fail with a target failure the loop can act on");
    assert.match(String(error), /in another record/, "the miss says why the selector's one answer was refused");
    return true;
  });

  // The same command, with the record it belonged to still on the page, resolves
  // the way it always did. The gate refuses another record, not every recording.
  const page = globalThis.document as unknown as { querySelector: unknown };
  Object.defineProperty(page, "querySelector", { value: () => rowAction("usr_a91"), configurable: true });
  Object.defineProperty(page, "querySelectorAll", { value: (selector: string) => (selector === ROW_SELECTOR ? [rowAction("usr_a91")] : []), configurable: true });
  assert.equal(resolveTarget(recordedRowAction()).resolution.strategy, "selector");
  assert.notEqual(resolveTarget(recordedRowAction()).element, occupant);
});
