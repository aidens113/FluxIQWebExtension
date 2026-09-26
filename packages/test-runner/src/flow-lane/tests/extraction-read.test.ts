import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { ExpectedExtraction, RunExtractionRead, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { validateRunExtractionRead } from "@fluxiq-web-extension/test-contracts";
import { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import { judgeFlowExtraction } from "../expectations.js";
import { extractionReadOf, extractionReadsByNode } from "../extraction-read.js";
import { flowLaneObservation } from "../lane-observation.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl, type PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import type { FlowRunDataset } from "../run-datasets.js";
import { flowExtractionSnapshot, flowLaneSnapshot, type FlowLaneEvidence } from "../run-flow-lane.js";

/**
 * A read as the domain reports it and Core projects it onto the attempt. The
 * record exists so that a read of zero records can say which of three things
 * happened to it, because the oracle's side of the comparison
 * (`observedRecords: 0`) cannot: the selector named nothing, the page held
 * nothing, or the conditions rejected every row.
 */
const FOUND: RunExtractionRead = { recordCount: 8, pagesRead: 1, truncated: false, fieldNames: ["name", "price"], missingFields: ["price"], listPresence: "appeared" };
const NEVER_APPEARED: RunExtractionRead = { recordCount: 0, pagesRead: 1, truncated: false, fieldNames: ["name", "price"], missingFields: [], listPresence: "never_appeared" };

/** What must never reach the bundle, in the places a producer could put it on a summary. */
const MUST_NOT_TRAVEL = ["#private-selector", "PRIVATE-PAGE-TEXT", "https://private.example.test/list"];

const attemptWith = (extraction: unknown): Record<string, unknown> => ({ metadata: { recordCount: 8, extraction } });

test("a read that found rows is rebuilt member by member from Core's metadata", () => {
  assert.deepEqual(extractionReadOf(attemptWith(FOUND)), FOUND);
  assert.deepEqual(validateRunExtractionRead(extractionReadOf(attemptWith(FOUND))), { valid: true, value: extractionReadOf(attemptWith(FOUND)) });
});

// The case the record was written for. A successful read of zero records whose
// item selector never named an element reads, in every other artifact, exactly
// like a page that held nothing -- and the two want different repairs.
test("a read whose list never appeared says so, which no count on the attempt could", () => {
  assert.deepEqual(extractionReadOf(attemptWith(NEVER_APPEARED)), NEVER_APPEARED);
});

test("the condition report travels whole, so a read that rejected every row is told from an empty page", () => {
  const filtered = { ...FOUND, recordCount: 30, missingFields: [], conditions: { applied: 30, kept: 0, rejected: [30, 2], unfiltered: true } };
  assert.deepEqual(extractionReadOf(attemptWith(filtered)), filtered);
});

test("absent stays absent: an attempt that reported no summary publishes none, and none is fabricated for it", () => {
  assert.equal(extractionReadOf({}), undefined, "an attempt with no metadata");
  assert.equal(extractionReadOf({ metadata: { recordCount: 8 } }), undefined, "an attempt that captured rows and reported no summary");
  assert.equal(extractionReadOf({ metadata: { extraction: {} } }), undefined, "an empty record is not a summary");
  assert.equal(extractionReadOf({ metadata: { extraction: "[withheld]" } }), undefined, "a withheld value");
});

// The summary arrives from a downstream host through Core and is parsed, not
// typed. Each of these is a value that could arrive and must not be published.
test("a summary this reader cannot rebuild whole is dropped whole, never published half-read", (t: TestContext) => {
  const cases: Array<[string, unknown]> = [
    ["a count that is not a count", { ...FOUND, recordCount: "eight" }],
    ["a negative count", { ...FOUND, pagesRead: -1 }],
    ["a flag that is not a flag", { ...FOUND, truncated: "no" }],
    ["a presence word this reader does not know", { ...FOUND, listPresence: "maybe" }],
    ["a field key that is page text", { ...FOUND, fieldNames: ["name", "PRIVATE-PAGE-TEXT here"], missingFields: [] }],
    ["a field key that is a selector", { ...FOUND, fieldNames: ["#private-selector"], missingFields: [] }],
    ["a field key that is a URL", { ...FOUND, fieldNames: ["https://private.example.test/list"], missingFields: [] }],
    ["a missing field the read never declared", { ...FOUND, missingFields: ["discount"] }],
    ["a field key named twice", { ...FOUND, fieldNames: ["name", "name"], missingFields: [] }],
    ["a condition report that kept more than it looked at", { ...FOUND, conditions: { applied: 2, kept: 3, rejected: [0], unfiltered: false } }],
    ["a condition report of no conditions", { ...FOUND, conditions: { applied: 2, kept: 1, rejected: [], unfiltered: false } }],
    ["an unbounded list of rejections", { ...FOUND, conditions: { applied: 2, kept: 1, rejected: Array.from({ length: 65 }, () => 0), unfiltered: false } }],
  ];
  for (const [what, extraction] of cases) t.assert.equal(extractionReadOf(attemptWith(extraction)), undefined, what);
});

test("a member the producer added beside the ones this reader knows stays behind", () => {
  const withExtra = { ...FOUND, itemSelector: "#private-selector", pageTitle: "PRIVATE-PAGE-TEXT" };
  assert.deepEqual(extractionReadOf(attemptWith(withExtra)), FOUND);
  assert.equal(JSON.stringify(extractionReadOf(attemptWith(withExtra))).includes("#private-selector"), false);
});

test("the reads are gathered per node, in attempt order, and a node that reported none has no entry", () => {
  const reads = extractionReadsByNode([
    { nodeId: "node.read", extraction: FOUND },
    { nodeId: "node.read", extraction: NEVER_APPEARED },
    { nodeId: "node.click" },
    { nodeId: null, extraction: FOUND },
  ]);
  assert.deepEqual([...reads.keys()], ["node.read"]);
  assert.deepEqual(reads.get("node.read"), [FOUND, NEVER_APPEARED]);
});

// --- The published shape ----------------------------------------------------

const script = (...stepIds: string[]): ScenarioStep[] => [
  { id: "open", operation: "click", target: "#open" },
  ...stepIds.map((id): ScenarioStep => ({ id, operation: "extract", target: ".item", fields: { name: ".name" } })),
];

const dataset = (nodeId: string, records: Array<Record<string, string | null>>): FlowRunDataset => ({
  datasetId: `dataset.${nodeId}`, nodeIds: [nodeId], records, recordCount: records.length,
  storeTruncated: false, invalidCount: 0, nonStringValues: 0, pages: 1,
});

const judged = (records: Array<Record<string, string | null>>, read: RunExtractionRead) => judgeFlowExtraction({
  expected: [{ step: "read-catalog", count: 2 }] satisfies ExpectedExtraction[],
  script: script("read-catalog"),
  datasets: [dataset("node.extract", records)],
  actionTypes: new Map([["node.extract", "web.dom.extract_list"]]),
  candidateOrder: new Map([["node.extract", 1]]),
  durationsByNode: new Map([["node.extract", 40]]),
  readsByNode: new Map([["node.extract", [read]]]),
  scenarioOrigin: "http://127.0.0.1:4310",
});

test("a judged step publishes the read's own account beside the oracle's comparison", () => {
  const found = flowExtractionSnapshot(judged([{ name: "Alpha" }, { name: "Beta" }], FOUND)).steps[0];
  assert.deepEqual(found?.reads, [FOUND]);
  assert.equal(found?.observedRecords, 2, "the oracle's side is unchanged");

  // The whole point, on a step the oracle can only call wrong: 0 observed
  // against 2 expected, and beside it the reason -- the list was never there.
  const empty = flowExtractionSnapshot(judged([], NEVER_APPEARED)).steps[0];
  assert.deepEqual(empty?.reads, [NEVER_APPEARED]);
  assert.equal(empty?.observedRecords, 0);
  assert.equal(empty?.reads?.[0]?.listPresence, "never_appeared");
});

test("a step whose reads reported nothing publishes an empty list, not a fabricated read", () => {
  const judgement = judgeFlowExtraction({
    expected: [{ step: "read-catalog", count: 2 }],
    script: script("read-catalog"),
    datasets: [dataset("node.extract", [])],
    actionTypes: new Map([["node.extract", "web.dom.extract_list"]]),
    candidateOrder: new Map([["node.extract", 1]]),
    durationsByNode: new Map(),
    scenarioOrigin: "http://127.0.0.1:4310",
  });
  assert.deepEqual(flowExtractionSnapshot(judgement).steps[0]?.reads, []);
});

// --- Through Core's run detail into the bundle -------------------------------

const summary = { runId: "run.one", projectId: "project.web", flowId: "flow.new", status: "succeeded", updatedAt: 2_000, actionAttemptCount: 2, routeDecisionCount: 0, subflowEntryCount: 0, interventionCount: 0, adaptationCount: 0 };

/**
 * A run of two extract attempts as Core's run detail states it: one read that
 * found rows, one whose list never appeared, each with page data beside the
 * summary that must not travel with it.
 */
function detailWithReads(): Record<string, unknown> {
  return {
    summary, routeDecisions: [], subflows: [], interventions: [], adaptationIds: [], changeProposalIds: [],
    actionAttempts: [
      {
        attemptId: "attempt.one", nodeId: "node.read", definitionId: "web.dom.extract_list", order: 0, status: "succeeded", startedAt: 1_000, finishedAt: 1_040,
        metadata: { recordCount: 8, extraction: { ...FOUND, itemSelector: "#private-selector" } },
      },
      {
        attemptId: "attempt.two", nodeId: "node.empty", definitionId: "web.dom.extract_list", order: 1, status: "succeeded", startedAt: 1_100, finishedAt: 1_140,
        metadata: { extraction: NEVER_APPEARED },
      },
    ],
  };
}

function json(payload: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json", ...headers } });
}

/** Core as the Flow lane meets it, serving the detail above. */
async function core(t: TestContext) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/auth/login") return json({ ok: true }, { "set-cookie": "fluxiq_session=opaque; Max-Age=3600" });
    if (url.pathname.endsWith("/get-flow-run-detail")) return json({ ok: true, payload: { runDetail: detailWithReads() } });
    throw new Error(`unexpected ${url.pathname}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const parser = new ExistingFluxIQControlClient("https://panel.example.test");
  await parser.login({ username: "runner", password: "password-value", totp: "123456", pin: "654321" });
  const control: PersistedFlowRunControl = {
    selectExistingContext: async () => { /* the lane's own call */ },
    startPersistedFlow: async () => ({ runId: "run.one" }),
    runPersistedFlow: async () => ({ session: { runId: "run.one", status: "succeeded" } }),
    automationStudioCall: async () => ({ runDetail: detailWithReads() }),
    getRunDetail: async (projectId, runId, bounds) => parser.getRunDetail(projectId, runId, bounds),
  };
  return { control };
}

/** The snapshot the runner writes, with nothing else in the evidence worth reading. */
function snapshotOf(outcome: PersistedFlowRunOutcome) {
  return flowLaneSnapshot({
    recording: { recordingId: "recording.one", entryCount: 1, entriesAppendedWhileWaiting: 0, waitedMs: 0, polls: 1 },
    proposal: { proposalId: "proposal.one", mapperId: "web-recording-actions", candidateCount: 1, issues: [] },
    flowId: "flow.new",
    run: outcome,
    observation: flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: outcome, automationFailureExpected: null }),
    extraction: { expectation: "not_expected", extractNodes: 0, unpairedDatasets: 0, nonStringValues: 0, steps: [] },
    startCandidateIndex: 0,
  } as unknown as FlowLaneEvidence);
}

test("every read reaches the bundle on its own attempt, including one no step judged", async (t) => {
  const { control } = await core(t);
  const outcome = await executeRecordedFlowRun(control, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });

  assert.deepEqual(outcome.actions.map((action) => action.extraction), [FOUND, NEVER_APPEARED]);
  const actions = snapshotOf(outcome).actions;
  assert.deepEqual(actions.map((action) => "extraction" in action ? action.extraction : null), [FOUND, NEVER_APPEARED]);

  // The selector Core carried beside the summary did not come with it.
  const written = JSON.stringify(snapshotOf(outcome));
  for (const secret of MUST_NOT_TRAVEL) assert.equal(written.includes(secret), false, secret);
});
