// A read whose selector drifted is never found by the words it reads (t743).
//
// Office rerun round 4: a Flow read a line an earlier step of its own changed,
// and the read failed. D2b taught the veto and the scorer that a target marked
// `readsWords` is judged without those words (`identity/read-words.ts`); this
// is the lookup half (`../resolve-target.ts`, header). Held on a library
// account page: the loan summary in `main` shows a due date a renewal just
// moved, and a "previous loans" sidebar beside it shows the old date. The read
// was saved with the old words, its selector has since drifted, and the
// neighbour in the sidebar is the one element on the page that shows them.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { BrowserActionCommand } from "../../types";
import { el, installStubDocument, stubDocument } from "../../tests/stub-dom";
import { resolveTarget, TargetResolutionError } from "../resolve-target";

const OLD_WORDS = "Due 3 May";

/** The account page: `summary` is the line the read means, `neighbour` the sidebar line showing its old words. */
function installAccount(t: TestContext, options: { classed?: boolean } = {}): { summary: Element; neighbour: Element } {
  const line = options.classed ? { class: "loan-line" } : {};
  const summary = el("p", { ...line }, "Due 10 May");
  const neighbour = el("p", { ...line }, OLD_WORDS);
  const document = stubDocument();
  document.append(el("html", {}, el("body", {},
    el("main", {}, el("div", { id: "loan-summary-v2" }, el("h2", {}, "Current loan"), summary)),
    el("aside", {}, el("div", { id: "previous-loans" }, el("h2", {}, "Previous loans"), neighbour)))));
  installStubDocument(t, document);
  return { summary: summary as unknown as Element, neighbour: neighbour as unknown as Element };
}

/** The read as it was saved, its selector naming a container the page has since renamed. */
function savedRead(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { tagName: "p", implicitRole: "paragraph", selector: "#loan-summary > p", visibleText: OLD_WORDS, context: { landmark: "main" }, readsWords: true, ...extra };
}

function command(actionType: string, element: Record<string, unknown>): BrowserActionCommand {
  return { commandId: `cmd-${actionType}`, actionType, element } as unknown as BrowserActionCommand;
}

/** The element resolved, or `undefined` when the resolution refused. Anything but a resolution failure is rethrown. */
function resolvedOrRefused(action: BrowserActionCommand): Element | undefined {
  try {
    return resolveTarget(action).element;
  } catch (error) {
    if (error instanceof TargetResolutionError) return undefined;
    throw error;
  }
}

test("a drifted read is not resolved to the neighbour that shows its old words", (t) => {
  const { neighbour } = installAccount(t);
  const chosen = resolvedOrRefused(command("web.dom.extract", savedRead()));
  assert.notEqual(chosen, neighbour, "the old words chose nothing");
});

test("a drifted read whose classes every line shares is resolved in its own landmark, not by its old words", (t) => {
  const { summary, neighbour } = installAccount(t, { classed: true });
  const chosen = resolvedOrRefused(command("web.dom.extract", savedRead({ classNames: ["loan-line"] })));
  assert.notEqual(chosen, neighbour);
  assert.equal(chosen, summary, "the summary line, by its classes in the recorded landmark");
});

test("the same target unmarked is still looked up by its words, as a press is today", (t) => {
  const { neighbour } = installAccount(t);
  const { readsWords: _mark, ...unmarked } = savedRead();
  // Before the mark this is what the read did, and what any unmarked target still does: the words found the neighbour.
  assert.equal(resolvedOrRefused(command("web.dom.extract", unmarked)), neighbour);
});

test("an unmarked press is still found by its words once its selector drifted", (t) => {
  const renew = el("button", { type: "button" }, "Renew loan");
  const other = el("button", { type: "button" }, "Return book");
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el("main", {}, el("div", { id: "loan-actions-v2" }, renew, other)))));
  installStubDocument(t, document);
  const resolved = resolveTarget(command("web.dom.click", { tagName: "button", implicitRole: "button", selector: "#loan-actions > button", visibleText: "Renew loan", accessibleName: "Renew loan" }));
  assert.equal(resolved.element, renew as unknown as Element);
});
