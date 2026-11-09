import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { controlIntentHost } from "./host";

test("an exact host absolute target gets its captured annotation with byte-for-byte unchanged parameters", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  targets.remember(scope, capture({ consent: true }));
  const handle = await resolve();
  assert.equal(handle.status, "resolved", JSON.stringify(handle));
  if (handle.status !== "resolved") return;
  const parameters = structuredClone(handle.parameters);
  const original = JSON.stringify(parameters);
  const absolute = await resolve(parameters);
  assert.equal(absolute.status, "resolved", JSON.stringify(absolute));
  if (absolute.status !== "resolved") return;
  assert.equal(JSON.stringify(absolute.parameters), original);
  assert.deepEqual(absolute.controlIntent, { intent: "accept", responseOnly: true });
  assert.equal(Object.hasOwn(absolute, "handleViews"), false);
  assert.equal(Object.hasOwn(absolute.parameters.element as object, "controlIntent"), false);
});

test("saved words, model intent fields and missing/wrong-scope evidence cannot invent a response-only annotation", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const parameters: JsonObject = {
    selector: "#answer", element: { selector: "#answer", tagName: "button", accessibleName: "Accept all", context: { dialog: "consent" }, controlIntent: { intent: "accept", responseOnly: true } },
    controlIntent: { intent: "accept", responseOnly: true }, responseOnly: true
  };
  assert.deepEqual(await resolve(parameters), { status: "unchanged" });
  targets.remember(scope, capture({ words: "Buy now" }));
  assert.deepEqual(await resolve(parameters), { status: "unchanged" });
  const forged = await resolve({ target: { handle: "t2" }, ...parameters, selector: { handle: "t2" } });
  assert.equal(forged.status, "resolved", JSON.stringify(forged));
  if (forged.status === "resolved") assert.deepEqual(forged.controlIntent, { intent: "accept" });
  const modelAbsolute = await resolve(parameters, { writtenByModel: true });
  assert.equal(modelAbsolute.status, "refused");
  const real = await resolve();
  if (real.status !== "resolved") assert.fail(JSON.stringify(real));
  assert.deepEqual(await resolve({ ...real.parameters, browserFrameId: 2 }), { status: "unchanged" });
  assert.deepEqual(await resolve(real.parameters, { onPage: "https://example.test/another-document" }), { status: "unchanged" });
});

test("a host absolute target with multiple retained source matches refuses rather than picking the permissive one", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const a = capture({ consent: true });
  targets.remember(scope, a);
  const original = await resolve();
  if (original.status !== "resolved") assert.fail(JSON.stringify(original));
  targets.remember(scope, capture({ location: "https://example.test/other" }));
  const ambiguous = await resolve(original.parameters);
  assert.equal(ambiguous.status, "refused", JSON.stringify(ambiguous));
  if (ambiguous.status === "refused") assert.ok(ambiguous.issueCodes.includes("web.handle.ambiguous"));
  const exact = await resolve(original.parameters, { onPage: a.evidence.location });
  assert.equal(exact.status, "resolved", JSON.stringify(exact));
  if (exact.status === "resolved") assert.deepEqual(exact.controlIntent, { intent: "accept", responseOnly: true });
});

test("identical observed controls stay ambiguous until one exact pre-act source establishes the host target's lineage", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const before = capture({ words: "Open folder" });
  targets.remember(scope, before);
  const original = await resolve();
  if (original.status !== "resolved") assert.fail(JSON.stringify(original));
  targets.remember(scope, capture({ words: "Open folder", location: "https://example.test/library" }));
  const unacted = await resolve(original.parameters, { handleReach: "view_history" });
  assert.equal(unacted.status, "refused", JSON.stringify(unacted));
  targets.acted(scope, "t2", before);
  const saved = JSON.stringify(original.parameters);
  for (const handleReach of [undefined, "view_history"] as const) {
    const recovered = await resolve(structuredClone(original.parameters), { handleReach });
    assert.equal(recovered.status, "resolved", JSON.stringify(recovered));
    if (recovered.status !== "resolved") continue;
    assert.equal(JSON.stringify(recovered.parameters), saved);
    assert.deepEqual(recovered.controlIntent, { intent: "neutral" });
    assert.equal(Object.hasOwn(recovered, "handleViews"), false);
    assert.equal(JSON.stringify(recovered.parameters).includes("controlIntent"), false);
  }
});

test("the same control acted on from two pages with one meaning resolves", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const first = capture({ words: "Open folder" });
  targets.remember(scope, first);
  const original = await resolve();
  if (original.status !== "resolved") assert.fail(JSON.stringify(original));
  targets.acted(scope, "t2", first);
  const second = capture({ words: "Open folder", location: "https://example.test/library", leading: 1 });
  targets.remember(scope, second);
  targets.acted(scope, "t3", second);
  const saved = JSON.stringify(original.parameters);
  const recovered = await resolve(structuredClone(original.parameters), { handleReach: "view_history" });
  assert.equal(recovered.status, "resolved", JSON.stringify(recovered));
  if (recovered.status !== "resolved") return;
  assert.equal(JSON.stringify(recovered.parameters), saved);
  assert.deepEqual(recovered.controlIntent, { intent: "neutral" });
});

test("two acted sources that disagree stay ambiguous", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const first = capture({ consent: true });
  targets.remember(scope, first);
  const original = await resolve();
  if (original.status !== "resolved") assert.fail(JSON.stringify(original));
  targets.acted(scope, "t2", first);
  const second = capture({ location: "https://example.test/library", leading: 1 });
  targets.remember(scope, second);
  targets.acted(scope, "t3", second);
  const conflict = await resolve(structuredClone(original.parameters), { handleReach: "view_history" });
  assert.equal(conflict.status, "refused", JSON.stringify(conflict));
  if (conflict.status === "refused") assert.ok(conflict.issueCodes.includes("web.handle.ambiguous"));
});

test("pre-act lineage cannot choose a permissive annotation over a competing observed semantic source", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const before = capture({ consent: true });
  targets.remember(scope, before);
  const original = await resolve();
  if (original.status !== "resolved") assert.fail(JSON.stringify(original));
  targets.acted(scope, "t2", before);
  targets.remember(scope, capture({ location: "https://example.test/offers" }));
  const conflict = await resolve(original.parameters, { handleReach: "view_history" });
  assert.equal(conflict.status, "refused", JSON.stringify(conflict));
  if (conflict.status === "refused") assert.ok(conflict.issueCodes.includes("web.handle.ambiguous"));
  const forged = await resolve({ ...original.parameters, source: { document: 1 }, controlIntent: { intent: "accept", responseOnly: true } }, { writtenByModel: true, handleReach: "view_history" });
  assert.equal(forged.status, "refused", JSON.stringify(forged));
});

test("a pre-act witness with another full fingerprint, frame or shadow scope cannot resolve later identical sources", async () => {
  for (const changed of [{ words: "View library" }, { frame: 4 }, { shadowHosts: ["#library"] }]) {
    const { targets, capture, scope, resolve } = controlIntentHost();
    const before = capture({ words: "Open folder" });
    targets.remember(scope, before);
    targets.acted(scope, "t2", before);
    const second = capture({ ...changed, words: changed.words ?? "Open folder", location: "https://example.test/library" });
    targets.remember(scope, second);
    const absolute = await resolve({ target: { handle: "t2", location: second.evidence.location } });
    if (absolute.status !== "resolved") assert.fail(JSON.stringify(absolute));
    targets.remember(scope, capture({ ...changed, words: changed.words ?? "Open folder", location: "https://example.test/archive" }));
    const ambiguous = await resolve(absolute.parameters, { handleReach: "view_history" });
    assert.equal(ambiguous.status, "refused", JSON.stringify(ambiguous));
    if (ambiguous.status === "refused") assert.ok(ambiguous.issueCodes.includes("web.handle.ambiguous"));
  }
});

test("Run Output and a bound target preserve the companion outside nested executable parameters", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  targets.remember(scope, capture({ consent: true }));
  const direct = await resolve();
  if (direct.status !== "resolved") assert.fail(JSON.stringify(direct));
  const nested = await resolve({ outputId: "web.dom.click", parameters: { target: { handle: "t2" } } }, { nodeDefinitionId: "builtin.policy.action" });
  assert.equal(nested.status, "resolved", JSON.stringify(nested));
  if (nested.status !== "resolved") return;
  assert.deepEqual(nested.controlIntent, direct.controlIntent);
  assert.equal(Object.hasOwn(nested.parameters.parameters as object, "controlIntent"), false);
  const absolute = await resolve(nested.parameters, { nodeDefinitionId: "builtin.policy.action" });
  assert.equal(absolute.status, "resolved", JSON.stringify(absolute));
  if (absolute.status === "resolved") assert.deepEqual(absolute.controlIntent, direct.controlIntent);
  const bound = await resolve({ target: { $state: { path: "input.control", fallback: { handle: "t2" } } } });
  assert.equal(bound.status, "resolved", JSON.stringify(bound));
  if (bound.status === "resolved") {
    assert.deepEqual(bound.controlIntent, direct.controlIntent);
    assert.equal(Object.hasOwn((bound.parameters.target as { $state: { fallback: object } }).$state.fallback, "controlIntent"), false);
  }
});

test("fact targets and unrelated non-executable parameters supply no control annotation", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  targets.remember(scope, capture({ consent: true }));
  const fact = await resolve(undefined, { nodeDefinitionId: "fluxiq.fact.target" });
  assert.equal(fact.status, "resolved", JSON.stringify(fact));
  assert.equal(Object.hasOwn(fact, "controlIntent"), false);
  const unrelated = await resolve({ url: "https://example.test/", controlIntent: { intent: "accept", responseOnly: true } }, { nodeDefinitionId: "web.output.browser-navigate" });
  assert.deepEqual(unrelated, { status: "unchanged" });
});

test("a saved absolute state fallback keeps its exact parameters and only the retained fallback's real intent", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  const captured = capture({ consent: true });
  targets.remember(scope, captured);
  const bound = await resolve({ target: { $state: { path: "input.control", fallback: { handle: "t2" } } } });
  if (bound.status !== "resolved") assert.fail(JSON.stringify(bound));
  const before = JSON.stringify(bound.parameters);
  const saved = await resolve(bound.parameters);
  assert.equal(saved.status, "resolved", JSON.stringify(saved));
  if (saved.status === "resolved") {
    assert.equal(JSON.stringify(saved.parameters), before);
    assert.deepEqual(saved.controlIntent, { intent: "accept", responseOnly: true });
    assert.equal(Object.hasOwn(saved, "handleViews"), false);
  }
  assert.deepEqual(await controlIntentHost().resolve(bound.parameters), { status: "unchanged" });
  assert.deepEqual(await resolve(bound.parameters, { onPage: "https://example.test/other" }), { status: "unchanged" });
  const conflict = await resolve({ ...bound.parameters, selector: "#unrelated" });
  assert.equal(conflict.status, "refused", JSON.stringify(conflict));
  if (conflict.status === "refused") assert.ok(conflict.issueCodes.includes("web.handle.ambiguous"));
  const model = await resolve(bound.parameters, { writtenByModel: true });
  assert.equal(model.status, "refused", JSON.stringify(model));
  if (model.status === "refused") assert.ok(model.issueCodes.includes("web.handle.not_a_handle"));
  targets.remember(scope, capture({ location: "https://example.test/second" }));
  const ambiguous = await resolve(bound.parameters);
  assert.equal(ambiguous.status, "refused", JSON.stringify(ambiguous));
});

test("frame and shadow mismatches cannot borrow an exact host target's classification", async () => {
  const { targets, capture, scope, resolve } = controlIntentHost();
  targets.remember(scope, capture({ consent: true, frame: 4, shadowHosts: ["#panel"] }));
  const original = await resolve();
  if (original.status !== "resolved") assert.fail(JSON.stringify(original));
  assert.deepEqual(await resolve({ ...original.parameters, browserFrameId: 5 }), { status: "unchanged" });
  assert.deepEqual(await resolve({ ...original.parameters, browserFrameUrlPath: "/other-document" }), { status: "unchanged" });
  const element = structuredClone(original.parameters.element) as JsonObject;
  element.context = { shadowHosts: ["#unrelated"] };
  assert.deepEqual(await resolve({ ...original.parameters, element }), { status: "unchanged" });
});
