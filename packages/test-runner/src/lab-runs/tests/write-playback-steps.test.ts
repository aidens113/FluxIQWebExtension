import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writePlaybackSteps } from "../index.js";

async function scratch(t: test.TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "playback-steps-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

const SECRET = "hunter2-correct-horse";
const KEY = `sk-${"a".repeat(24)}`;

/** One command attempt as Core persists it, cut to the fields the writer reads plus the page snapshot it must not copy. */
function attempt(id: string, at: number, overrides: { actionType?: string; status?: string; text?: string; failure?: Record<string, unknown>; redacted?: boolean; page?: string } = {}) {
  const actionType = overrides.actionType ?? "web.dom.click";
  return {
    attempt: {
      attemptId: `attempt.${id}`, commandId: `command.${id}`, status: overrides.status ?? "succeeded", dispatchedAt: at, settledAt: at + 400,
      command: { kind: "execute_action", actionType, outputId: actionType, parameters: { selector: "#go", ...(overrides.text === undefined ? {} : { text: overrides.text }) } },
      result: {
        status: overrides.status ?? "succeeded", message: overrides.failure ? "Action refused by the page for now." : "Element clicked.",
        ...(overrides.failure ? { failure: overrides.failure } : {}),
        ...(overrides.page ? { metadata: { failureEvidence: { page: overrides.page } } } : {}),
        payload: { result: { url: "http://127.0.0.1:1/x", title: "Shop", snapshot: { interactiveElements: [{ value: "field value on the page" }] }, ...(overrides.text === undefined ? {} : { validation: { status: "passed", expected: `the field holds "${overrides.text}"`, actual: `the field holds "${overrides.text}"`, redacted: overrides.redacted === true } }) } },
      },
    },
  };
}

async function setUp(t: test.TestContext, attempts: Record<string, unknown>) {
  const root = await scratch(t);
  const attemptsDirectory = path.join(root, "command-attempts");
  const stepsDirectory = path.join(root, "steps");
  for (const [id, value] of Object.entries(attempts)) {
    await mkdir(path.join(attemptsDirectory, `attempt.${id}`), { recursive: true });
    await writeFile(path.join(attemptsDirectory, `attempt.${id}`, "attempt.json"), JSON.stringify(value));
  }
  // Core's own last step, which the playback is numbered after and listed beside.
  await mkdir(path.join(stepsDirectory, "0045-judge"), { recursive: true });
  await writeFile(path.join(stepsDirectory, "0045-judge", "meta.json"), JSON.stringify({ step: 45, kind: "judge", summary: "diagnosis: the Flow ran", costUsd: 0.001225 }));
  return { attemptsDirectory, stepsDirectory };
}

test("each playback attempt in the window becomes a run step after Core's, in dispatch order, and index.md lists them", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, {
    build: attempt("build", 500),
    b: attempt("b", 2000, { status: "failed", failure: { category: "action_failed", code: "web.action.rate_limited", retryable: true, stage: "execution", expected: "the page accepts the press", actual: "it was busy", effect: "unacted" }, page: "PAGE \"Shop\"" }),
    a: attempt("a", 1000, { actionType: "web.dom.type", text: "3" }),
    replay: attempt("replay", 9000),
  });
  const written = await writePlaybackSteps({ attemptsDirectory, stepsDirectory, since: 1000, until: 5000, redactionLiterals: [] });
  assert.deepEqual(written, { steps: [46, 47], redacted: 0, skipped: 0, stateRouted: 0 });
  assert.deepEqual((await readdir(stepsDirectory)).sort(), ["0045-judge", "0046-run-web.dom.type", "0047-run-web.dom.click", "index.md"]);
  const typed = path.join(stepsDirectory, "0046-run-web.dom.type");
  assert.deepEqual(JSON.parse(await readFile(path.join(typed, "call.json"), "utf8")).parameters, { selector: "#go", text: "3" });
  const failed = path.join(stepsDirectory, "0047-run-web.dom.click");
  assert.deepEqual(JSON.parse(await readFile(path.join(failed, "meta.json"), "utf8")), {
    step: 47, kind: "run", callId: "attempt.b", toolId: "web.dom.click", startedAt: new Date(2000).toISOString(), finishedAt: new Date(2400).toISOString(), ms: 400,
    phase: "playback", status: "failed", resultCode: "web.action.rate_limited", failureCode: "web.action.rate_limited", message: "Action refused by the page for now.",
    summary: "web.action.rate_limited: Action refused by the page for now.",
  });
  const result = JSON.parse(await readFile(path.join(failed, "result.json"), "utf8"));
  assert.equal(result.failure.actual, "it was busy");
  assert.equal(await readFile(path.join(failed, "page.txt"), "utf8"), "PAGE \"Shop\"");
  assert.equal(JSON.stringify(result).includes("field value on the page"), false, "the page snapshot is never copied");
  assert.deepEqual((await readFile(path.join(stepsDirectory, "index.md"), "utf8")).split("\n").slice(-4), [
    "| 0045 | judge | - | diagnosis: the Flow ran | $0.001225 |",
    "| 0046 | run | web.dom.type | Element clicked. | - |",
    "| 0047 | run | web.dom.click | web.action.rate_limited: Action refused by the page for now. | - |",
    "",
  ]);
});

test("a declared literal, a credential shape and a value the extension marked redacted are never written", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, {
    secret: attempt("secret", 1000, { actionType: "web.dom.type", text: SECRET }),
    sensitive: attempt("sensitive", 1100, { actionType: "web.dom.type", text: "4111 1111", redacted: true }),
    key: attempt("key", 1200, { status: "failed", failure: { code: "web.action.failed", actual: `Bearer ${"b".repeat(24)} and ${KEY}` } }),
  });
  const written = await writePlaybackSteps({ attemptsDirectory, stepsDirectory, since: 0, until: 5000, redactionLiterals: [SECRET] });
  assert.deepEqual(written.steps, [46, 47, 48]);
  for (const folder of await readdir(stepsDirectory)) {
    if (!folder.includes("-run-")) continue;
    for (const file of await readdir(path.join(stepsDirectory, folder))) {
      const content = await readFile(path.join(stepsDirectory, folder, file), "utf8");
      for (const leaked of [SECRET, "4111 1111", KEY, "b".repeat(24)]) assert.equal(content.includes(leaked), false, `${folder}/${file} holds ${leaked}`);
    }
    assert.equal(JSON.parse(await readFile(path.join(stepsDirectory, folder, "meta.json"), "utf8")).redacted, true, `${folder} says it was redacted`);
  }
});

const NOT_FOUND = { category: "target_not_found", code: "web.target.not_found", retryable: false, stage: "target_resolution", expected: "the Accept button", actual: "no such control on the page" };

test("a host attempt the run skipped (a sometimes-present step observed absent) is written as skipped, never failed", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, {
    popup: attempt("popup", 1000, { status: "failed", failure: NOT_FOUND }),
    // The same failure on a step the run did not skip stays a failure.
    real: attempt("real", 3000, { status: "failed", failure: NOT_FOUND }),
  });
  const written = await writePlaybackSteps({
    attemptsDirectory, stepsDirectory, since: 0, until: 5000, redactionLiterals: [],
    skippedSteps: [{ nodeId: "node.popup", startedAt: 900, finishedAt: 1500, reason: "target_absent", code: "web.target.not_found" }],
  });
  assert.deepEqual(written.steps, [46, 47]);
  const skipped = path.join(stepsDirectory, "0046-run-web.dom.click");
  const meta = JSON.parse(await readFile(path.join(skipped, "meta.json"), "utf8"));
  assert.equal(meta.status, "skipped");
  assert.equal(meta.failureCode, null);
  assert.deepEqual(meta.skipped, { reason: "target_absent", code: "web.target.not_found", nodeId: "node.popup" });
  assert.match(meta.summary, /^skipped/u);
  const result = JSON.parse(await readFile(path.join(skipped, "result.json"), "utf8"));
  assert.equal(result.status, "skipped");
  assert.equal(result.failure, null);
  assert.equal(result.observed.actual, "no such control on the page", "what observed the absence is kept as evidence");
  assert.equal(JSON.parse(await readFile(path.join(stepsDirectory, "0047-run-web.dom.click", "meta.json"), "utf8")).status, "failed");
  const index = await readFile(path.join(stepsDirectory, "index.md"), "utf8");
  assert.match(index, /\| 0046 \| run \| web\.dom\.click \| skipped/u);
  assert.match(index, /\| 0047 \| run \| web\.dom\.click \| web\.target\.not_found:/u);
});

test("a skip that dispatched nothing (its ready state was judged not shown) is its own skipped step, in time order", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, { a: attempt("a", 1000), b: attempt("b", 3000) });
  const written = await writePlaybackSteps({
    attemptsDirectory, stepsDirectory, since: 0, until: 5000, redactionLiterals: [],
    skippedSteps: [
      { nodeId: "node.banner", startedAt: 2000, finishedAt: 2000, reason: "target_absent", code: "executor.ready_state.not_shown" },
      // Outside the playback's window: a build's or a later replay's skip.
      { nodeId: "node.other", startedAt: 9000, finishedAt: 9000, reason: "target_absent", code: "executor.ready_state.not_shown" },
    ],
  });
  assert.deepEqual(written.steps, [46, 47, 48]);
  assert.deepEqual((await readdir(stepsDirectory)).sort(), ["0045-judge", "0046-run-web.dom.click", "0047-run-skipped", "0048-run-web.dom.click", "index.md"]);
  const meta = JSON.parse(await readFile(path.join(stepsDirectory, "0047-run-skipped", "meta.json"), "utf8"));
  assert.equal(meta.status, "skipped");
  assert.deepEqual(meta.skipped, { reason: "target_absent", code: "executor.ready_state.not_shown", nodeId: "node.banner" });
  assert.equal(JSON.parse(await readFile(path.join(stepsDirectory, "0047-run-skipped", "call.json"), "utf8")).dispatched, false);
});

test("a run with no command attempts writes nothing and leaves Core's index alone", async (t) => {
  const root = await scratch(t);
  assert.deepEqual(await writePlaybackSteps({ attemptsDirectory: path.join(root, "absent"), stepsDirectory: path.join(root, "steps"), since: 0, until: 1, redactionLiterals: [] }), { steps: [], redacted: 0, skipped: 0, stateRouted: 0 });
});

// A step passed over because the page was elsewhere (Core t243 state routing) is
// a runtime step that consulted the page: written as skipped, saying where the
// run went and which way, never as the failure its host attempt observed.
test("a state-routed step is written as skipped with where the run went, never failed, and the playback counts it", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, {
    store: attempt("store", 1000, { status: "failed", failure: NOT_FOUND }),
    search: attempt("search", 3000),
  });
  const written = await writePlaybackSteps({
    attemptsDirectory, stepsDirectory, since: 0, until: 9000, redactionLiterals: [],
    skippedSteps: [
      { nodeId: "node.store", startedAt: 900, finishedAt: 1500, reason: "state_routed", code: "web.target.not_found", toNodeId: "node.search", direction: "forward" },
      { nodeId: "node.cart", startedAt: 4000, finishedAt: 4000, reason: "state_routed", code: "executor.ready_state.not_shown", toNodeId: "node.store", direction: "backward" },
      { nodeId: "node.popup", startedAt: 5000, finishedAt: 5000, reason: "target_absent", code: "executor.ready_state.not_shown" },
    ],
  });
  assert.deepEqual(written, { steps: [46, 47, 48, 49], redacted: 0, skipped: 3, stateRouted: 2 });
  const routedMeta = JSON.parse(await readFile(path.join(stepsDirectory, "0046-run-web.dom.click", "meta.json"), "utf8"));
  assert.equal(routedMeta.status, "skipped");
  assert.equal(routedMeta.failureCode, null);
  assert.deepEqual(routedMeta.skipped, { reason: "state_routed", code: "web.target.not_found", nodeId: "node.store", toNodeId: "node.search", direction: "forward" });
  assert.match(routedMeta.summary, /^skipped \(state_routed, web\.target\.not_found\): routed to node\.search \(forward\)/u);
  const routedResult = JSON.parse(await readFile(path.join(stepsDirectory, "0046-run-web.dom.click", "result.json"), "utf8"));
  assert.equal(routedResult.status, "skipped");
  assert.equal(routedResult.failure, null);
  assert.equal(routedResult.observed.code, "web.target.not_found", "what the runtime observed before it consulted the page is kept as evidence");
  const backward = JSON.parse(await readFile(path.join(stepsDirectory, "0048-run-skipped", "meta.json"), "utf8"));
  assert.equal(backward.status, "skipped");
  assert.match(backward.summary, /routed to node\.store \(backward\)/u);
  const absent = JSON.parse(await readFile(path.join(stepsDirectory, "0049-run-skipped", "meta.json"), "utf8"));
  assert.deepEqual(absent.skipped, { reason: "target_absent", code: "executor.ready_state.not_shown", nodeId: "node.popup" }, "a sometimes-present skip names no destination");
  assert.doesNotMatch(absent.summary, /routed/u);
  const index = await readFile(path.join(stepsDirectory, "index.md"), "utf8");
  assert.match(index, /\| 0046 \| run \| web\.dom\.click \| skipped \(state_routed, web\.target\.not_found\): routed to node\.search \(forward\)/u);
  assert.doesNotMatch(index, /\| 0046 [^\n]*failed/u);
});

test("every step the runtime consulted the page for says what it made of it: a failed one, a routed one, and one that dispatched nothing", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, {
    store: attempt("store", 1000, { status: "failed", failure: NOT_FOUND }),
    search: attempt("search", 3000, { status: "failed", failure: NOT_FOUND }),
    gated: attempt("gated", 6000),
  });
  const written = await writePlaybackSteps({
    attemptsDirectory, stepsDirectory, since: 0, until: 9000, redactionLiterals: [],
    skippedSteps: [{ nodeId: "node.search", startedAt: 2900, finishedAt: 3500, reason: "state_routed", code: "web.target.not_found", toNodeId: "node.cart", direction: "forward" }],
    stateRoutingSteps: [
      { nodeId: "node.store", startedAt: 900, finishedAt: 1500, outcome: "no_match", code: "web.target.not_found" },
      { nodeId: "node.search", startedAt: 2900, finishedAt: 3500, outcome: "effect_holds" },
      { nodeId: "node.cart", startedAt: 4000, finishedAt: 4000, outcome: "guard_stopped", code: "executor.ready_state.not_shown", toNodeId: "node.store" },
      { nodeId: "node.gated", startedAt: 5900, finishedAt: 6500, outcome: "unobserved", code: "executor.ready_state.not_shown" },
    ],
  });
  assert.deepEqual(written, { steps: [46, 47, 48, 49], redacted: 0, skipped: 1, stateRouted: 1 });
  const failed = JSON.parse(await readFile(path.join(stepsDirectory, "0046-run-web.dom.click", "meta.json"), "utf8"));
  assert.equal(failed.status, "failed", "a consultation that found no way on does not hide the failure");
  assert.deepEqual(failed.stateRouting, { outcome: "no_match", code: "web.target.not_found" });
  assert.match(failed.summary, /^web\.target\.not_found: .*; the runtime consulted state: no_match$/u);
  const routed = JSON.parse(await readFile(path.join(stepsDirectory, "0047-run-web.dom.click", "meta.json"), "utf8"));
  assert.equal(routed.status, "skipped");
  assert.match(routed.summary, /routed to node\.cart \(forward\).*; the runtime consulted state: effect_holds$/u);
  assert.deepEqual(JSON.parse(await readFile(path.join(stepsDirectory, "0047-run-web.dom.click", "result.json"), "utf8")).stateRouting, { outcome: "effect_holds" });
  const stopped = JSON.parse(await readFile(path.join(stepsDirectory, "0048-run-state-consulted", "meta.json"), "utf8"));
  assert.equal(stopped.status, "failed");
  assert.match(stopped.summary, /the runtime consulted state: guard_stopped \(kept returning to node\.store\)$/u);
  assert.deepEqual(JSON.parse(await readFile(path.join(stepsDirectory, "0048-run-state-consulted", "call.json"), "utf8")), { nodeId: "node.cart", dispatched: false });
  const gated = JSON.parse(await readFile(path.join(stepsDirectory, "0049-run-web.dom.click", "meta.json"), "utf8"));
  assert.equal(gated.status, "ok", "the readiness gate asked before the dispatch, which then ran");
  assert.match(gated.summary, /; the runtime consulted state: unobserved$/u);
  const index = await readFile(path.join(stepsDirectory, "index.md"), "utf8");
  assert.match(index, /\| 0046 [^\n]*the runtime consulted state: no_match/u);
});

test("a run whose steps all ran writes no consultation", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, { a: attempt("a", 1000) });
  await writePlaybackSteps({ attemptsDirectory, stepsDirectory, since: 0, until: 9000, redactionLiterals: [], stateRoutingSteps: [] });
  const meta = JSON.parse(await readFile(path.join(stepsDirectory, "0046-run-web.dom.click", "meta.json"), "utf8"));
  assert.equal("stateRouting" in meta, false);
  assert.doesNotMatch(meta.summary, /consulted/u);
});

// `run-musp8nz1-dbd3905a`: Core wrote the playback's post-run check as 0048
// (18:07:03) while the playback ran 18:06:34-18:07:01, and the playback, written
// after Core stopped, came out as 0049-0061 -- after the check of its result.
// The playback is numbered at its own time, and Core's later steps move after it.
test("playback steps are numbered in time order: a Core step that started after them moves after them", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, { a: attempt("a", 1000), b: attempt("b", 2000) });
  await mkdir(path.join(stepsDirectory, "0046-decide"));
  await writeFile(path.join(stepsDirectory, "0046-decide", "meta.json"), JSON.stringify({ step: 46, kind: "decide", startedAt: new Date(500).toISOString(), summary: "the build's last decision" }));
  await mkdir(path.join(stepsDirectory, "0047-judge"));
  await writeFile(path.join(stepsDirectory, "0047-judge", "meta.json"), JSON.stringify({ step: 47, kind: "judge", startedAt: new Date(6000).toISOString(), summary: "the post-run check" }));
  await writeFile(path.join(stepsDirectory, "0047-judge", "request.txt"), "kept");
  const written = await writePlaybackSteps({ attemptsDirectory, stepsDirectory, since: 1000, until: 5000, redactionLiterals: [] });
  assert.deepEqual(written.steps, [47, 48]);
  assert.deepEqual((await readdir(stepsDirectory)).sort(), ["0045-judge", "0046-decide", "0047-run-web.dom.click", "0048-run-web.dom.click", "0049-judge", "index.md"]);
  assert.equal(JSON.parse(await readFile(path.join(stepsDirectory, "0049-judge", "meta.json"), "utf8")).step, 49, "the moved step's meta says its new number");
  assert.equal(await readFile(path.join(stepsDirectory, "0049-judge", "request.txt"), "utf8"), "kept", "and keeps everything else in its folder");
  assert.deepEqual((await readFile(path.join(stepsDirectory, "index.md"), "utf8")).split("\n").slice(-3, -1).map(row => row.split(" | ").slice(0, 2).join(" | ")), ["| 0048 | run", "| 0049 | judge"]);
});

// The shape run-musp39u8-9ac026ab's playback read left in its command attempt:
// the read's summary beside the rows it returned. Its step folder recorded
// `validation: null` and nothing else; the counts were only in flow-lane.json.
test("a list read's step carries the read's counts and the count of rows it returned, never a row's values", async (t) => {
  const read = attempt("read", 1000, { actionType: "web.dom.extract_list" });
  const rows = Array.from({ length: 13 }, (_, index) => ({ name: `Private Earbud ${index}`, price: "$29.99", rating: "4.5", url: `https://shop.example/p/${index}` }));
  Object.assign(read.attempt.result.payload.result, {
    extracted: rows,
    extraction: { recordCount: 13, pagesRead: 5, truncated: false, fieldNames: ["name", "price", "rating", "url"], missingFields: [], itemsSeen: 94, emptyRecords: 0, conditions: { applied: 94, kept: 15, rejected: [20, 37, 34, 40, 2], unfiltered: false }, paginationStop: "control_disabled" },
  });
  read.attempt.result.message = "List extracted.";
  // The gateway dispatcher's wrapping, `{ status, message, result }`, is read at the same depth Core reads it.
  const wrapped = attempt("wrapped", 2000, { actionType: "web.dom.extract_list" });
  Object.assign(wrapped.attempt.result.payload.result, { result: { extracted: [{ name: "Private Earbud" }], extraction: { recordCount: 1, pagesRead: 1, truncated: true, fieldNames: ["name"], missingFields: [], paginationStop: "a word from a newer producer" } } });
  const { attemptsDirectory, stepsDirectory } = await setUp(t, { read, wrapped });
  await writePlaybackSteps({ attemptsDirectory, stepsDirectory, since: 0, until: 5000, redactionLiterals: [] });
  const folder = path.join(stepsDirectory, "0046-run-web.dom.extract_list");
  const result = JSON.parse(await readFile(path.join(folder, "result.json"), "utf8"));
  assert.deepEqual(result.read, { records: 13, pages: 5, itemsSeen: 94, emptyRecords: 0, truncated: false, stop: "control_disabled", conditionsKept: 15, rowsReturned: 13 });
  const meta = JSON.parse(await readFile(path.join(folder, "meta.json"), "utf8"));
  assert.equal(meta.summary, "List extracted. 13 records over 5 pages (94 items seen, stopped on control_disabled); 13 rows returned");
  const other = JSON.parse(await readFile(path.join(stepsDirectory, "0047-run-web.dom.extract_list", "result.json"), "utf8"));
  assert.deepEqual(other.read, { records: 1, pages: 1, itemsSeen: null, emptyRecords: null, truncated: true, stop: "unknown", conditionsKept: null, rowsReturned: 1 });
  for (const name of ["result.json", "meta.json", "call.json"]) {
    for (const dir of ["0046-run-web.dom.extract_list", "0047-run-web.dom.extract_list"]) {
      assert.equal((await readFile(path.join(stepsDirectory, dir, name), "utf8")).includes("Private Earbud"), false, `${dir}/${name} holds no row value`);
    }
  }
});

test("a step that is not a list read carries no read record", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, { a: attempt("a", 1000) });
  await writePlaybackSteps({ attemptsDirectory, stepsDirectory, since: 0, until: 5000, redactionLiterals: [] });
  const result = JSON.parse(await readFile(path.join(stepsDirectory, "0046-run-web.dom.click", "result.json"), "utf8"));
  assert.equal("read" in result, false);
});
