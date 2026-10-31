import assert from "node:assert/strict";
import test from "node:test";
import { controlIntentHost } from "./host";

test("reused handles retain each selected page's real identity and intent, including a page available only historically", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const a = capture({ consent: true, location: "https://example.test/a", selector: "#answer-a" });
  const b = capture({ words: "Buy now", location: "https://example.test/b", selector: "#answer-b" });
  targets.remember(scope, a);
  targets.remember(scope, b);
  assert.deepEqual(targets.resolve(scope, "t2", undefined), { ok: false, code: "ambiguous" });
  targets.remember(scope, capture({ location: a.evidence.location, empty: true }));
  const original = await resolve({ target: { handle: "t2", location: a.evidence.location } }, { handleReach: "view_history" });
  assert.equal(original.status, "resolved", JSON.stringify(original));
  if (original.status !== "resolved") return;
  assert.equal(original.parameters.selector, "#answer-a");
  assert.equal((original.parameters.element as { accessibleName?: string }).accessibleName, "Accept all");
  assert.deepEqual(original.controlIntent, { intent: "accept", responseOnly: true });
  assert.deepEqual(original.handleViews, [{ handle: "t2", view: 1, location: a.evidence.location }]);
  const latest = await resolve({ target: { handle: "t2", location: b.evidence.location } }, { handleReach: "view_history" });
  assert.equal(latest.status, "resolved", JSON.stringify(latest));
  if (latest.status !== "resolved") return;
  assert.equal(latest.parameters.selector, "#answer-b");
  assert.deepEqual(latest.controlIntent, { intent: "accept" });
});

test("same-selector cross-page and cross-view semantic conflicts refuse instead of dropping or choosing an annotation", async () => {
  for (const samePage of [false, true]) {
    const { targets, capture, scope, resolve } = controlIntentHost();
    const a = capture({ consent: true });
    const b = capture({ location: samePage ? a.evidence.location : "https://example.test/other" });
    targets.remember(scope, a);
    targets.remember(scope, b);
    for (const handleReach of samePage ? ["view_history"] as const : [undefined, "view_history"] as const) {
      const answer = await resolve(undefined, { handleReach });
      assert.equal(answer.status, "refused", JSON.stringify(answer));
      assert.ok(answer.status === "refused" && answer.issueCodes.includes("web.handle.ambiguous"));
    }
    if (!samePage) {
      const exact = await resolve({ target: { handle: "t2", location: a.evidence.location } });
      assert.equal(exact.status, "resolved", JSON.stringify(exact));
      if (exact.status === "resolved") assert.deepEqual(exact.controlIntent, { intent: "accept", responseOnly: true });
    }
  }
});

test("current exact-page resolution uses its newest actual intent while historical attribution refuses an unacted semantic conflict", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const before = capture({ words: "Buy now" });
  targets.remember(scope, before);
  targets.rememberLook(scope, capture({ words: "Done" }));
  for (const extra of [{}, { onPage: before.evidence.location }]) {
    const current = await resolve(undefined, extra);
    assert.equal(current.status, "resolved", JSON.stringify(current));
    if (current.status === "resolved") {
      assert.deepEqual(current.controlIntent, { intent: "neutral" });
      assert.equal((current.parameters.element as { accessibleName?: string }).accessibleName, "Done");
    }
  }
  const historical = await resolve(undefined, { handleReach: "view_history" });
  assert.equal(historical.status, "refused", JSON.stringify(historical));
  if (historical.status === "refused") assert.ok(historical.issueCodes.includes("web.handle.ambiguous"));
});

test("pre-act restoration cannot erase a bare cross-page semantic conflict even when the permissive source is newest", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  targets.remember(scope, capture({ location: "https://example.test/offer" }));
  const consent = capture({ consent: true });
  targets.remember(scope, consent);
  targets.acted(scope, "t2", consent);
  const bare = await resolve(undefined, { handleReach: "view_history" });
  assert.equal(bare.status, "refused", JSON.stringify(bare));
  if (bare.status === "refused") assert.ok(bare.issueCodes.includes("web.handle.ambiguous"));
  const exact = await resolve({ target: { handle: "t2", location: consent.evidence.location } }, { handleReach: "view_history" });
  assert.equal(exact.status, "resolved", JSON.stringify(exact));
  if (exact.status === "resolved") assert.deepEqual(exact.controlIntent, { intent: "accept", responseOnly: true });
});

test("pre-act restoration carries its original intent and never the changed done-label classification", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const before = capture({ consent: true });
  const after = capture({ words: "Done", consent: true });
  targets.remember(scope, before);
  targets.acted(scope, "t2", before, after);
  targets.rememberLook(scope, after);
  const answer = await resolve(undefined, { handleReach: "view_history" });
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
  if (answer.status !== "resolved") return;
  assert.equal((answer.parameters.element as { accessibleName?: string }).accessibleName, "Accept all");
  assert.deepEqual(answer.controlIntent, { intent: "accept", responseOnly: true });
  assert.equal(Object.hasOwn(answer.parameters, "controlIntent"), false);
  // Caller mutation cannot change the retained classification.
  (answer.controlIntent as { intent: string }).intent = "dismiss";
  const again = await resolve(undefined, { handleReach: "view_history" });
  if (again.status === "resolved") assert.deepEqual(again.controlIntent, { intent: "accept", responseOnly: true });
  else assert.fail(JSON.stringify(again));
});

test("an original historical pre-act target remains bound to its document after that page changes documents", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const original = capture({ consent: true, document: 11 });
  targets.remember(scope, original);
  targets.acted(scope, "t2", original);
  targets.remember(scope, capture({ empty: true, document: 12 }));
  const answer = await resolve(undefined, { handleReach: "view_history" });
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
  if (answer.status === "resolved") assert.deepEqual(answer.controlIntent, { intent: "accept", responseOnly: true });
});

test("pre-act source collisions across location, document, frame and layer cannot lend response-only intent", async () => {
  for (const changed of [
    { location: "https://example.test/other" }, { document: 2 }, { frame: 4 }, { layer: "#other-layer" }
  ]) {
    const { targets, capture, scope, resolve } = controlIntentHost();
    const original = capture({ consent: true });
    targets.remember(scope, original);
    targets.acted(scope, "t2", original);
    const other = capture({ ...changed, words: "Buy now" });
    targets.remember(scope, other);
    const answer = await resolve({ target: { handle: "t2", location: other.evidence.location } }, { handleReach: "view_history" });
    assert.equal(answer.status, "resolved", JSON.stringify(answer));
    if (answer.status === "resolved") assert.equal((answer.parameters.element as { accessibleName?: string }).accessibleName, "Buy now");
    if (answer.status === "resolved") assert.deepEqual(answer.controlIntent, { intent: "accept" });
  }
});

test("target slot reconciliation refuses equal selectors in different shadow scopes", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const a = capture({ consent: true, shadowHosts: ["#first"] });
  const b = capture({ words: "Buy now", location: "https://example.test/b", shadowHosts: ["#second"] });
  targets.remember(scope, a);
  targets.remember(scope, b);
  const answer = await resolve({ selector: { handle: "t2", location: a.evidence.location }, element: { handle: "t2", location: b.evidence.location } });
  assert.equal(answer.status, "refused", JSON.stringify(answer));
});
