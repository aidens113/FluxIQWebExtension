import assert from "node:assert/strict";
import test from "node:test";
import { screenWebBuildRefusalDiagnostic, webBuildRefusalDiagnostic } from "..";
import type { WebLlmPageEvidence } from "../../sanitize";

function page(): WebLlmPageEvidence {
  return {
    schemaVersion: "web-llm-evidence.v2", trust: "untrusted-page-evidence", location: "https://private.test/account?token=synthetic-secret", title: "Private account", truncated: false,
    elements: [
      { target: "t1", tag: "button", name: "Private customer name", coveredBy: ["t2", "t3"] },
      { target: "t2", tag: "div", name: "Private consent wording", kind: "consent", covers: ["t1"] },
      { target: "t3", tag: "dialog", name: "Private check wording", isDialog: { modal: true, kind: "robot_check" } },
    ],
  };
}

test("a refused call records its pre-call target and covering layers without page content", () => {
  const before = page();
  const diagnostic = webBuildRefusalDiagnostic({ page: before, parameters: { target: { handle: "t1" }, value: "synthetic-secret" }, code: "blocked_by_dialog", reason: "modal_dialog_open" });
  // Use a known domain reason, not a sentence or an invented label.
  const withoutReason = webBuildRefusalDiagnostic({ page: before, parameters: { target: { handle: "t1" } }, code: "blocked_by_dialog" });
  assert.deepEqual(withoutReason, { schemaVersion: "web-build-refusal.v1", phase: "before_action", code: "blocked_by_dialog", pageObserved: true, target: "t1", targetObserved: true, coveringTargets: ["t2", "t3"], coveringKinds: ["consent", "robot_check"], coveringCount: 2 });
  assert.doesNotMatch(JSON.stringify(withoutReason), /Private|https|token|synthetic-secret/u);
  before.elements.length = 0;
  assert.deepEqual(withoutReason?.coveringTargets, ["t2", "t3"]);
  assert.equal(diagnostic, undefined, "an invented reason is not admitted");
});

test("missing page and unobserved targets remain explicit rather than inventing coverage", () => {
  const absent = webBuildRefusalDiagnostic({ parameters: { selector: "t8" }, code: "target_unobserved", reason: "nothing_observed_yet" });
  assert.equal(absent?.pageObserved, false);
  assert.equal(absent?.targetObserved, false);
  assert.deepEqual(absent?.coveringTargets, []);
  const unknown = webBuildRefusalDiagnostic({ page: page(), target: "t8", code: "target_unobserved", reason: "handle_not_in_packet" });
  assert.equal(unknown?.pageObserved, true);
  assert.equal(unknown?.targetObserved, false);
  assert.equal(unknown?.coveringCount, 0);
});

test("the bundle screen rejects extra data and malicious values even when they look like codes", () => {
  const good = webBuildRefusalDiagnostic({ page: page(), target: "t1", code: "blocked_by_dialog" })!;
  assert.deepEqual(screenWebBuildRefusalDiagnostic(good), good);
  for (const extra of [{ pageText: "Private words" }, { token: "synthetic-secret" }, { url: "https://private.test" }]) assert.equal(screenWebBuildRefusalDiagnostic({ ...good, ...extra }), undefined);
  for (const code of ["synthetic_secret", "https://private.test", "Private sentence"]) assert.equal(screenWebBuildRefusalDiagnostic({ ...good, code }), undefined);
  for (const target of ["#password", "token.synthetic-secret", "https://private.test"]) assert.equal(screenWebBuildRefusalDiagnostic({ ...good, target }), undefined);
  assert.equal(screenWebBuildRefusalDiagnostic({ ...good, coveringKinds: ["synthetic_secret"] }), undefined);
  assert.equal(screenWebBuildRefusalDiagnostic({ ...good, coveringTargets: ["#account"] }), undefined);
  assert.equal(screenWebBuildRefusalDiagnostic({ ...good, reason: "synthetic_secret" }), undefined);
});

test("a handle the model wrote the pre-t223 way is recorded as the tN it means", () => {
  const expected = { schemaVersion: "web-build-refusal.v1", phase: "before_action", code: "blocked_by_dialog", pageObserved: true, target: "t1", targetObserved: true, coveringTargets: ["t2", "t3"], coveringKinds: ["consent", "robot_check"], coveringCount: 2 };
  assert.deepEqual(webBuildRefusalDiagnostic({ page: page(), target: "target.1", code: "blocked_by_dialog" }), expected);
  assert.deepEqual(webBuildRefusalDiagnostic({ page: page(), parameters: { target: { handle: "target.1" } }, code: "blocked_by_dialog" }), expected);
  assert.deepEqual(webBuildRefusalDiagnostic({ page: page(), parameters: { selector: "target.1" }, code: "blocked_by_dialog" }), expected);
  assert.equal(webBuildRefusalDiagnostic({ page: page(), parameters: { element: "target.1" }, code: "blocked_by_dialog" })?.target, "t1");
});

test("the bundle screen reads a legacy record as tN and round-trips a tN one", () => {
  const legacy = { schemaVersion: "web-build-refusal.v1", phase: "before_action", code: "blocked_by_dialog", pageObserved: true, target: "target.1", targetObserved: true, coveringTargets: ["target.2"], coveringKinds: ["consent"], coveringCount: 1 };
  const screened = screenWebBuildRefusalDiagnostic(legacy);
  assert.equal(screened?.target, "t1");
  assert.deepEqual(screened?.coveringTargets, ["t2"]);
  assert.deepEqual(screenWebBuildRefusalDiagnostic(screened), screened);
  const current = { ...legacy, target: "t1", coveringTargets: ["t2"] };
  assert.deepEqual(screenWebBuildRefusalDiagnostic(current), current);
});

test("the bundle screen rejects what is not a handle in either spelling", () => {
  const good = webBuildRefusalDiagnostic({ page: page(), target: "t1", code: "blocked_by_dialog" })!;
  for (const handle of ["t0", "t1234567", "target.0"]) {
    assert.equal(screenWebBuildRefusalDiagnostic({ ...good, target: handle }), undefined, `target ${handle}`);
    assert.equal(screenWebBuildRefusalDiagnostic({ ...good, coveringTargets: [handle, "t3"] }), undefined, `covering target ${handle}`);
  }
});
