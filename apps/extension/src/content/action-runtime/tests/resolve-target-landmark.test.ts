import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { BrowserActionCommand } from "../../types";
import { el, installStubDocument, stubDocument } from "../../tests/stub-dom";
import { resolveTarget, TargetResolutionError } from "../resolve-target";

/** An ID/class restyle with identical labels and destinations in separate landmarks. */
function libraryPage(t: TestContext, options: { missing?: boolean; twins?: boolean; footerCount?: number } = {}) {
  const primary = el("a", { id: "library-open-v2", class: "new-link", href: "/library" }, "Open library");
  const second = el("a", { id: "library-other-v2", class: "new-link", href: "/library" }, "Open library");
  const footers = Array.from({ length: options.footerCount ?? 1 }, (_, index) => el("a", { id: `footer-${index}`, class: "old-link", href: "/library" }, "Open library"));
  const navigation = el("nav", {}, ...(options.missing ? [] : options.twins ? [primary, second] : [primary]));
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el("footer", {}, ...footers), ...(options.missing ? [] : [navigation]))));
  installStubDocument(t, document);
  for (const element of document.descendants()) Object.defineProperty(element, "ownerDocument", { value: document });
  assert.ok(primary instanceof Element);
  return { primary, document };
}

function savedClick(selector = "#library-original"): BrowserActionCommand {
  return {
    commandId: "command.landmark", actionType: "web.dom.click", selector,
    element: {
      tagName: "a", implicitRole: "link", id: "library-original", selector: "#library-original", classNames: ["old-link"],
      accessibleName: "Open library", context: { landmark: "navigation" }
    }
  };
}

function failure(action: BrowserActionCommand): TargetResolutionError {
  try {
    resolveTarget(action);
  } catch (error) {
    if (error instanceof TargetResolutionError) return error;
    throw error;
  }
  assert.fail("a missing or genuinely ambiguous target must not resolve");
}

test("simultaneous ID/class drift resolves the original navigation link over its footer twin", (t) => {
  const { primary } = libraryPage(t);
  const resolved = resolveTarget(savedClick());
  assert.equal(resolved.element, primary);
  assert.equal(resolved.resolution.strategy, "scored-candidate");
  assert.equal(resolved.resolution.candidateCount, 1);
});

test("a weak exact selector counts only the recorded landmark before choosing among duplicate labels", (t) => {
  const { primary } = libraryPage(t);
  const resolved = resolveTarget(savedClick("a"));
  assert.equal(resolved.element, primary);
  assert.equal(resolved.resolution.strategy, "selector");
  assert.equal(resolved.resolution.candidateCount, 1);
});

test("removing the original landmark refuses the perfectly named footer fallback", (t) => {
  libraryPage(t, { missing: true });
  assert.equal(failure(savedClick()).failure.code, "web.target.not_found");
});

test("two real controls inside the recorded landmark remain ambiguous", (t) => {
  libraryPage(t, { twins: true });
  assert.equal(failure(savedClick()).failure.code, "web.target.ambiguous");
});

test("unrelated footer links cannot consume the candidate cap before place admission", (t) => {
  const { primary } = libraryPage(t, { footerCount: 75 });
  const resolved = resolveTarget(savedClick());
  assert.equal(resolved.element, primary);
  assert.equal(resolved.resolution.candidateCount, 1);
});

test("stable-name rescue cannot make a footer control the missing navigation target", (t) => {
  const footer = el("button", { id: "state-control" }, el("span", {}, "Cart"), " ", el("span", {}, "4 items"));
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el("footer", {}, footer))));
  installStubDocument(t, document);
  const action: BrowserActionCommand = { commandId: "command.state", actionType: "web.dom.click", selector: "#state-control", element: {
    tagName: "button", implicitRole: "button", selector: "#state-control", accessibleName: "Cart 1 item", visibleText: "Cart 1 item", context: { landmark: "navigation" }
  } };
  assert.equal(failure(action).failure.code, "web.target.not_found");
});

test("stable-name rescue counts matching state controls only within the recorded landmark", (t) => {
  const primary = el("button", { id: "state-control" }, el("span", {}, "Cart"), " ", el("span", {}, "4 items"));
  const footer = el("button", {}, el("span", {}, "Cart"), " ", el("span", {}, "8 items"));
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el("footer", {}, footer), el("nav", {}, primary))));
  installStubDocument(t, document);
  assert.ok(primary instanceof Element);
  const action: BrowserActionCommand = { commandId: "command.state", actionType: "web.dom.click", selector: "#state-control", element: {
    tagName: "button", implicitRole: "button", selector: "#state-control", accessibleName: "Cart 1 item", visibleText: "Cart 1 item", context: { landmark: "navigation" }
  } };
  assert.equal(resolveTarget(action).element, primary);
});
