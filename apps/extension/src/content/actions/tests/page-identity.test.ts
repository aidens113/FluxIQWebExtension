// PAGE_CHANGED has a producer, and these rows are what says so.
//
// The code sat in the domain's closed set from the day the set was written with
// nothing anywhere emitting it. A closed vocabulary exists so a consumer can
// derive its handling from the members; one that is never produced is a promise
// the browser path does not keep, and the next author reads it as evidence that
// unproduced codes are normal. So the first row here is the one that matters:
// drive `executeContentAction` with a verb that fails while the page moves
// under it, and assert the reply carries `web.page.changed`. Before
// `page-identity.ts` existed that row read `web.target.not_found` -- the verb's
// own answer, describing a page that had already gone.
//
// The rest are the rule's edges, and each is a way the substitution could do
// harm rather than good:
//
//   - A succeeded action is never rewritten. A click on a link *is* a
//     navigation, and the most common action in any recording; reporting it as
//     a page change would make PAGE_CHANGED the most frequent failure in the
//     corpus and mean nothing.
//   - AUTH_REQUIRED survives. A page that navigated to a sign-in wall has
//     changed and the honest instruction is still "sign in", not "retry".
//   - A page that did not move leaves the verb's own code alone, and so does a
//     frame with no page to read at all -- which is every Node test of a verb,
//     since the verbs take the page as injected capabilities.
//
// The globals are stubbed rather than a DOM being provided: what is under test
// is the comparison and the precedence, not the browser's navigation. The real
// document, the real inert shell and the real hit test are the content
// harness's job.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { executeContentAction } from "../execute";
import { observePageIdentity, reportPageChange } from "../page-identity";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult } from "../../types";

const COMMAND: BrowserActionCommand = { commandId: "cmd-page", actionType: "web.dom.click", selector: "#save" };

/** A page the test can navigate: `location.href` is writable and `documentElement` is one stable object. */
type StubPage = { go(href: string): void; replaceDocument(): void };

function installPage(t: TestContext, href = "https://app.test/orders"): StubPage {
  const location = { href };
  const root = { tag: "html" };
  // The runner imports every test bundle into one Node process, so a stub left
  // on the global outnumbers this file: a module that installs listeners at load
  // behind `typeof document !== "undefined"` would crash on a stub that cannot
  // answer them. So the stub answers, and the previous global is put back after.
  const document = {
    documentElement: root as unknown,
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
    querySelector: (): unknown => null,
    querySelectorAll: (): unknown[] => []
  };
  const previous = {
    location: Object.getOwnPropertyDescriptor(globalThis, "location"),
    document: Object.getOwnPropertyDescriptor(globalThis, "document")
  };
  Object.defineProperty(globalThis, "location", { value: location, configurable: true, writable: true });
  Object.defineProperty(globalThis, "document", { value: document, configurable: true, writable: true });
  t.after(() => {
    restore("location", previous.location);
    restore("document", previous.document);
  });
  return {
    go: (next: string) => { location.href = next; },
    replaceDocument: () => { document.documentElement = { tag: "html" }; }
  };
}

function restore(name: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete (globalThis as Record<string, unknown>)[name];
}

/**
 * A result the way `action-runtime/results.ts` builds one, reproduced here
 * because the real builder reads the page globals and the capture settings at
 * module load and cannot be imported into Node at all.
 */
function failedResult(code: Parameters<typeof webAutomationFailureRecord>[0], actual: string): BrowserActionResult {
  return {
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status: "failed",
    validation: { status: "failed", expected: "the recorded control", actual },
    url: "https://app.test/orders",
    startedAt: 1,
    finishedAt: 2,
    failure: webAutomationFailureRecord(code, { expected: "the recorded control", actual })
  } as BrowserActionResult;
}

/** Dependencies whose click verb moves the page and then fails, the way a verb that waited would. */
function depsThatNavigate(page: StubPage, to: string): ContentActionDependencies {
  return {
    failure: (_action: BrowserActionCommand, error: unknown) => failedResult(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, String(error)),
    resolveTarget: () => {
      page.go(to);
      return failThrough();
    }
  } as unknown as ContentActionDependencies;
}

function failThrough(): never {
  throw new Error("the recorded control is not on this page");
}

test("a verb that fails while the page navigates under it reports PAGE_CHANGED, not its own code", async (t) => {
  const page = installPage(t);

  const result = await executeContentAction(COMMAND, depsThatNavigate(page, "https://app.test/orders/4172"));

  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED, "the page moved, so the verb's own cause is not the cause");
  assert.equal(result.failure?.category, "page_changed");
  assert.equal(result.failure?.retryable, true);
  assert.equal(result.failure?.stage, "execution");
  // Nothing is lost: the superseded code and its sentence ride in `actual`.
  assert.match(result.failure?.actual ?? "", /the page navigated to a different URL while the action ran/u);
  assert.match(result.failure?.actual ?? "", /web\.action\.failed/u);
  // No URL text, because a query string is where a session token rides.
  assert.doesNotMatch(result.failure?.actual ?? "", /https:\/\//u);
  // And Core's parser keeps it, which a hand-assembled record cannot be trusted to do.
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a document swapped out from under the action is reported as a replacement, not a navigation", (t) => {
  const page = installPage(t);
  const before = observePageIdentity();
  page.replaceDocument();

  const result = reportPageChange(failedResult(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, "nothing matched"), before);

  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED);
  assert.match(result.failure?.actual ?? "", /the document was replaced while the action ran/u);
});

test("a succeeded action is never rewritten, however far the page moved", (t) => {
  const page = installPage(t);
  const before = observePageIdentity();
  page.go("https://app.test/thanks");

  const succeeded = { ...failedResult(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, "unused"), status: "succeeded" as const };
  delete succeeded.failure;

  assert.equal(reportPageChange(succeeded, before).failure, undefined, "a click that navigates is the commonest action there is");
});

test("AUTH_REQUIRED survives a page change, because signing in is not retrying", (t) => {
  const page = installPage(t);
  const before = observePageIdentity();
  page.go("https://app.test/login");

  const result = reportPageChange(failedResult(WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED, "the document is a sign-in gate"), before);

  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED);
});

test("a page that did not move leaves the verb's own code exactly as it was", (t) => {
  installPage(t);
  const before = observePageIdentity();

  const result = reportPageChange(failedResult(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, "the field did not keep the text"), before);

  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
});

test("with no page to read, the question is not asked and nothing is substituted", (t) => {
  // The globals are removed rather than assumed absent: the runner imports every
  // test bundle into one Node process, and another bundle
  // (`action-runtime/tests/assertion-evaluation.test.ts`) leaves a `location`
  // on the global. Both are put back when this row ends.
  withoutPage(t);
  assert.equal(observePageIdentity(), undefined, "a frame with no location and no document cannot be asked");

  const result = reportPageChange(failedResult(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, "nothing matched"), undefined);

  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
});

/** Takes `location` and `document` off the global for one row, and puts whatever was there back. */
function withoutPage(t: TestContext): void {
  for (const name of ["location", "document"]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    delete (globalThis as Record<string, unknown>)[name];
    t.after(() => { restore(name, previous); });
  }
}
