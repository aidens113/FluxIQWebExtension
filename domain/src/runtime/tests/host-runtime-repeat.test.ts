import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../output-nodes";
import { createWebAutomationHostRuntime, type WebAutomationHostRuntimeBoundary, type WebAutomationHostRuntimeGateway } from "../host-runtime";

type ObserveInput = Parameters<NonNullable<WebAutomationHostRuntimeBoundary["observeRuntimeRepeat"]>>[0];
const read = { id: "read", definitionId: webAutomationOutputNodeId("web.dom.capture_snapshot"), parameterValues: {} };
const click = { id: "click", definitionId: webAutomationOutputNodeId("web.dom.click"), parameterValues: { selector: "#apply", element: { tagName: "button", accessibleName: "Apply" } } };

function snapshot(extra: JsonObject = {}): JsonObject {
  return {
    url: "https://controls.test/preferences", title: "Preferences", frame: { isTop: true },
    interactiveElements: [{ tagName: "button", selector: "#apply", accessibleName: "Apply" }],
    evidence: {
      elements: { scanned: 1, candidates: 1, matched: 1, returned: 1, truncated: false },
      loading: { documentState: "complete", busy: false, pendingNavigation: false },
      navigation: { timeOrigin: 42 }, captureOptions: { includeHidden: false },
      frameCoverage: { mode: "all_frames", enumeration: "complete", frameIds: [0], capturedFrameIds: [0] }
    }, ...extra
  };
}

function host(pages: JsonObject[], sources: string[] = [], sessions: string[] = []) {
  let commands = 0;
  const gateway: WebAutomationHostRuntimeGateway = { dispatch: async (request) => {
    const index = commands++;
    return { outputId: request.outputId, ok: true, status: "succeeded", metadata: { sessionId: sessions[index] ?? "paired.one" }, payload: { result: { snapshot: pages[index] ?? pages[0], sourceId: sources[index] ?? "tab:17:frame:0" } } } as OutputDispatchResult<JsonObject>;
  } };
  const runtime = createWebAutomationHostRuntime(gateway);
  async function capture(node = read, point: "before_action" | "after_action" = "before_action") {
    const input = { node, inputs: {}, attemptId: `attempt.${commands}`, point };
    const stateRef = await runtime.captureStateSnapshot!(input);
    return { ...input, stateRef } as ObserveInput;
  }
  return { runtime, capture, commands: () => commands };
}

test("actual host observer compares semantic state across fresh refs and selectors without another command", async () => {
  const second = snapshot({ interactiveElements: [{ tagName: "button", selector: "#fresh", accessibleName: "Apply" }] });
  const h = host([snapshot(), second]);
  const a = await h.capture(click);
  const b = await h.capture({ ...click, parameterValues: { ...click.parameterValues, selector: "#fresh" } }, "after_action");
  assert.notEqual(a.stateRef.stateRef, b.stateRef.stateRef);
  const before = await h.runtime.observeRuntimeRepeat!(a);
  const after = await h.runtime.observeRuntimeRepeat!(b);
  assert.equal(before.kind, "observed");
  assert.deepEqual(before, after);
  assert.equal(h.commands(), 2);
  if (before.kind !== "observed") return;
  for (const token of [before.resource, before.viewDigest, before.target.kind === "identified" ? before.target.key : "none"]) {
    assert.ok(token.length > 0 && token.length <= 256);
    assert.equal(JSON.stringify(a.stateRef).includes(token), false);
  }
  assert.doesNotMatch(JSON.stringify(before), /controls\.test|paired\.one|Apply|#apply/);
});

test("shown field values and changed views produce different checksums", async () => {
  const field = (value: string) => snapshot({ interactiveElements: [{ tagName: "input", selector: "#field", accessibleName: "Name", value }] });
  const h = host([field("A"), field("B"), snapshot()]);
  const results = [];
  for (let index = 0; index < 3; index++) results.push(await h.runtime.observeRuntimeRepeat!(await h.capture()));
  assert.ok(results.every((result) => result.kind === "observed"));
  const [first, second, third] = results;
  assert.ok(first?.kind === "observed");
  assert.ok(second?.kind === "observed");
  assert.ok(third?.kind === "observed");
  assert.notEqual(first.viewDigest, second.viewDigest);
  assert.notEqual(second.viewDigest, third.viewDigest);
});

test("actual tab, session and document incarnation distinguish equivalent page content", async () => {
  const changed = snapshot();
  (changed.evidence as JsonObject).navigation = { timeOrigin: 43 };
  const h = host([snapshot(), snapshot(), snapshot(), changed], ["tab:17:frame:0", "tab:18:frame:0", "tab:18:frame:0", "tab:18:frame:0"], ["paired.one", "paired.one", "paired.two", "paired.two"]);
  const resources = [];
  for (let index = 0; index < 4; index++) {
    const result = await h.runtime.observeRuntimeRepeat!(await h.capture());
    assert.equal(result.kind, "observed");
    if (result.kind === "observed") resources.push(result.resource);
  }
  assert.equal(new Set(resources).size, 4);
});

test("partial, loading, unanswered, malformed and unproved scope captures abstain", async () => {
  const variants = [snapshot({ frame: {} }), snapshot({ interactiveElements: [{ tagName: "button" }] }), snapshot({ evidence: {} }), snapshot({ truncated: true })];
  for (const mutate of [
    (page: JsonObject) => { ((page.evidence as JsonObject).elements as JsonObject).truncated = true; },
    (page: JsonObject) => { ((page.evidence as JsonObject).loading as JsonObject).busy = true; },
    (page: JsonObject) => { ((page.evidence as JsonObject).loading as JsonObject).documentState = "interactive"; },
    (page: JsonObject) => { (page.evidence as JsonObject).unansweredFrameIds = [2]; },
    (page: JsonObject) => { ((page.evidence as JsonObject).navigation as JsonObject).timeOrigin = "unknown"; },
    (page: JsonObject) => { (page.interactiveElements as JsonObject[])[0]!.value = {}; },
    (page: JsonObject) => { (page.interactiveElements as JsonObject[])[0]!.selector = "frame[2] >> #apply"; }
  ]) {
    const page = snapshot();
    mutate(page);
    variants.push(page);
  }
  for (const page of variants) {
    const h = host([page]);
    assert.equal((await h.runtime.observeRuntimeRepeat!(await h.capture())).kind, "unavailable");
    assert.equal(h.commands(), 1);
  }
  for (const source of ["tab:17:frame:2", "unknown"]) {
    const h = host([snapshot()], [source]);
    assert.equal((await h.runtime.observeRuntimeRepeat!(await h.capture())).kind, "unavailable");
  }
});

test("target identity requires captured independent signals, unique record-aware match and actual addressing", async () => {
  const ambiguous = snapshot({ interactiveElements: [{ tagName: "button", selector: "#apply", accessibleName: "Apply" }, { tagName: "button", selector: "#other", accessibleName: "Apply" }] });
  (ambiguous.evidence as JsonObject).elements = { scanned: 2, candidates: 2, matched: 2, returned: 2, truncated: false };
  for (const [page, parameters] of [
    [snapshot(), { selector: "#apply", element: { selector: "#apply" } }],
    [snapshot(), { selector: "#wrong", element: click.parameterValues.element }],
    [ambiguous, click.parameterValues],
    [snapshot(), { selector: "#apply", element: { ...click.parameterValues.element, context: { record: { key: "another-record" } } } }],
    [snapshot(), { selector: "#apply" }]
  ] as [JsonObject, JsonObject][]) {
    const h = host([page]);
    assert.equal((await h.runtime.observeRuntimeRepeat!(await h.capture({ ...read, definitionId: click.definitionId, parameterValues: parameters }))).kind, "unavailable");
  }
  const h = host([snapshot()]);
  const input = await h.capture(click);
  assert.deepEqual(await h.runtime.observeRuntimeRepeat!({ ...input, inputs: { item: { name: "a row" } } }), { kind: "unavailable", reason: "unsupported" });
  assert.deepEqual(await h.runtime.observeRuntimeRepeat!({ ...input, node: { ...click, parameterValues: { ...click.parameterValues, visualTarget: { x: 1, y: 1 } } } }), { kind: "unavailable", reason: "unsupported" });
});

test("positive top-only proof requires actual complete frame enumeration and replies", async () => {
  const markers = [
    undefined, null, {}, "complete",
    { mode: "all_frames", enumeration: "unavailable", frameIds: [0], capturedFrameIds: [0] },
    { mode: "single_frame", enumeration: "complete", frameIds: [0], capturedFrameIds: [0] },
    { mode: "all_frames", enumeration: "complete", frameIds: [], capturedFrameIds: [] },
    { mode: "all_frames", enumeration: "complete", frameIds: [0, 0], capturedFrameIds: [0] },
    { mode: "all_frames", enumeration: "complete", frameIds: [0], capturedFrameIds: [0, 0] },
    { mode: "all_frames", enumeration: "complete", frameIds: [0, 2], capturedFrameIds: [0, 2] },
    { mode: "all_frames", enumeration: "complete", frameIds: [0, 2], capturedFrameIds: [0] },
    { mode: "all_frames", enumeration: "complete", frameIds: [0], capturedFrameIds: [2] },
    { mode: "all_frames", enumeration: "complete", frameIds: ["0"], capturedFrameIds: [0] },
    { mode: "all_frames", enumeration: "complete", frameIds: [0] }
  ];
  for (const marker of markers) {
    const page = snapshot();
    const evidence = page.evidence as JsonObject;
    if (marker === undefined) delete evidence.frameCoverage;
    else evidence.frameCoverage = marker as JsonObject["frameCoverage"];
    const h = host([page]);
    const input = await h.capture();
    assert.equal(input.stateRef.summary?.schemaVersion, "web-llm-page.v3");
    assert.deepEqual(await h.runtime.observeRuntimeRepeat!(input), { kind: "unavailable", reason: "partial" });
    assert.equal(h.commands(), 1);
  }
});

test("accepted previous state reuse retains private proof while forged and evicted refs do not", async () => {
  const h = host([snapshot()]);
  const first = await h.capture();
  const before = await h.runtime.observeRuntimeRepeat!(first);
  const reused = await h.runtime.captureStateSnapshot!({ ...first, previousStateRef: first.stateRef });
  assert.equal(reused, first.stateRef);
  assert.deepEqual(await h.runtime.observeRuntimeRepeat!({ ...first, stateRef: reused }), before);
  assert.equal(h.commands(), 1);
  for (const stateRef of [{ ...first.stateRef, capturedAt: -1 }, { ...first.stateRef, stateSnapshotId: "foreign" }, { ...first.stateRef, stateRef: "foreign" }]) {
    assert.deepEqual(await h.runtime.observeRuntimeRepeat!({ ...first, stateRef }), { kind: "unavailable", reason: "missing" });
  }
  for (let index = 0; index < 32; index++) await h.capture();
  assert.deepEqual(await h.runtime.observeRuntimeRepeat!(first), { kind: "unavailable", reason: "missing" });
});

test("abort and unreadable input fail closed with fixed reasons and no error text", async () => {
  const h = host([snapshot()]);
  const input = await h.capture();
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await h.runtime.observeRuntimeRepeat!({ ...input, signal: controller.signal }), { kind: "unavailable", reason: "unreadable" });
  const malformed = { ...input, get stateRef(): ObserveInput["stateRef"] { throw new Error("PRIVATE_SENTINEL"); } };
  assert.deepEqual(await h.runtime.observeRuntimeRepeat!(malformed), { kind: "unavailable", reason: "unreadable" });
  assert.equal(h.commands(), 1);
});

test("shown coverage does not require hidden-world proof and policy wrappers use the same captured subject", async () => {
  const page = snapshot();
  delete (page.evidence as JsonObject).captureOptions;
  const h = host([page]);
  const input = await h.capture();
  const targetless = await h.runtime.observeRuntimeRepeat!(input);
  assert.equal(targetless.kind, "observed");
  if (targetless.kind === "observed") assert.deepEqual(targetless.target, { kind: "none" });
  const policy = { id: "recorded", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.click", parameters: click.parameterValues } };
  const identified = await h.runtime.observeRuntimeRepeat!({ ...input, node: policy });
  assert.equal(identified.kind, "observed");
  if (identified.kind === "observed") assert.equal(identified.target.kind, "identified");
  for (const node of [{ ...read, definitionId: webAutomationOutputNodeId("web.dom.scroll") }, { ...read, definitionId: "arbitrary.action" }]) {
    assert.deepEqual(await h.runtime.observeRuntimeRepeat!({ ...input, node }), { kind: "unavailable", reason: "unsupported" });
  }
  assert.equal(h.commands(), 1);
});

test("producer-shaped includeHidden captures count shown entries while retaining hidden descriptors", async () => {
  const withHidden = snapshot({ interactiveElements: [
    { tagName: "button", selector: "#apply", accessibleName: "Apply" },
    { tagName: "button", selector: "#collapsed", accessibleName: "Collapsed control", hidden: true }
  ] });
  // Content capture passes shown to pageEvidence: returned/matched remain 1,
  // even though interactiveElements has two entries. scanned/candidates can
  // include visited unrendered nodes; they are not the descriptor-list length.
  (withHidden.evidence as JsonObject).captureOptions = { includeHidden: true };
  const h = host([snapshot(), withHidden]);
  const a = await h.runtime.observeRuntimeRepeat!(await h.capture());
  const b = await h.runtime.observeRuntimeRepeat!(await h.capture());
  assert.equal(a.kind, "observed");
  assert.deepEqual(a, b);
  assert.equal(h.commands(), 2);
});

test("captured record identity distinguishes same-word controls in different records", async () => {
  const pages = ["first", "second"].map((key) => snapshot({ interactiveElements: [{ tagName: "button", selector: "#apply", accessibleName: "Apply", context: { record: { key, keyAttribute: "data-row-id" } } }] }));
  const h = host(pages);
  const observations = [];
  for (const key of ["first", "second"]) {
    const node = { ...click, parameterValues: { ...click.parameterValues, element: { ...click.parameterValues.element, context: { record: { key, keyAttribute: "data-row-id" } } } } };
    observations.push(await h.runtime.observeRuntimeRepeat!(await h.capture(node)));
  }
  const [first, second] = observations;
  assert.ok(first?.kind === "observed");
  assert.ok(second?.kind === "observed");
  assert.notDeepEqual(first.target, second.target);
});

test("a different bound host cannot share private resource tokens", async () => {
  const a = host([snapshot()]);
  const b = host([snapshot()]);
  const left = await a.runtime.observeRuntimeRepeat!(await a.capture());
  const right = await b.runtime.observeRuntimeRepeat!(await b.capture());
  assert.equal(left.kind, "observed");
  assert.equal(right.kind, "observed");
  assert.notEqual(left.kind === "observed" && left.resource, right.kind === "observed" && right.resource);
});
