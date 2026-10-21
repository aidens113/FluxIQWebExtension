// The web domain's offline reevaluator (traces and offline trials, P5, tier 2):
// a changed read answered from the page snapshot recorded with the replaced
// read's own result, run in a sandboxed page beside a control -- the recorded
// command replayed over the same snapshot (D37). Every row drives the factory
// with a fake sandbox (no browser) that tells the control from the changed
// read by command id, and the domain's real gateway-result builder, and checks
// one rule: what is eligible, where the snapshot comes from, when the control
// vouches for the snapshot, and what the answer carries.
// The page text below is synthetic; no recorded page data is used.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActionResult, ClientGatewayTraceReevaluationRequest, ClientGatewayTraceReevaluator } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionCommand, WebAutomationActionResult } from "../../../actions/types";
import { gatewayActionResultFromBrowserResult } from "../../../client";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../../failure";
import { createWebOfflineReadReevaluator } from "../reevaluator";
import type { WebPageSnapshot, WebSnapshotPage, WebSnapshotPageEvaluation, WebSnapshotSandboxObservations } from "../snapshot-page";

const PRIMARY = "a".repeat(64);
const STYLE = "b".repeat(64);
const IMAGE = "c".repeat(64);
const LATER = "d".repeat(64);
const PAGE_URL = "https://shop.example.test/catalog";
const TRIAL_ID = "cmd-trial-1";
const RECORDED_ID = "cmd-recorded-1";
const encoder = new TextEncoder();
const STORE: Readonly<Record<string, Uint8Array>> = {
  [PRIMARY]: encoder.encode("<html><body><ul><li class=row>One</li></ul></body></html>"),
  [STYLE]: encoder.encode("li{}"),
  [LATER]: encoder.encode("<html>later</html>")
};

/** What the sandbox sees of one bounded list read: its one reveal of the list's end moves the page (P5d). */
const ONE_REVEAL: WebSnapshotSandboxObservations = { scriptsRan: 0, requestsLeaked: 0, navigationsHeld: 0, requestsRefused: 0, scrollsPastEnd: 1 };

const LIST_COMMAND = {
  commandId: TRIAL_ID,
  actionType: "web.dom.extract_list",
  parameters: { extractList: { item: "li.row", fields: { name: "li.row" }, where: [{ field: "name", contains: "One" }] } }
};
const RECORDED_LIST_COMMAND = { commandId: RECORDED_ID, actionType: "web.dom.extract_list", parameters: { extractList: { item: "li.row", fields: { name: "li.row" } } } };

const TRACE_METADATA: JsonObject = {
  artifacts: [
    { sha256: PRIMARY, mediaType: "text/html", byteLength: 60, role: "primary", source: PAGE_URL },
    { sha256: STYLE, mediaType: "text/css", byteLength: 4, role: "resource", source: "https://shop.example.test/site.css" },
    { sha256: IMAGE, mediaType: "image/png", byteLength: 9, role: "resource", source: "https://shop.example.test/a.png" }
  ],
  unavailable: 1
};

const ONE_PAGE: JsonObject = { recordCount: 1, pagesRead: 1, itemsSeen: 1, truncated: false, missingFields: [], fieldNames: ["name"], listPresence: "appeared" };

type Extraction = WebAutomationActionResult["extraction"];
type Failure = WebAutomationActionResult["failure"];

function summary(fields: JsonObject = {}): Extraction {
  return { ...ONE_PAGE, ...fields } as unknown as Extraction;
}

const OUTPUT_NOT_OBSERVED: Failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);

/** A content result as the page returns it: the sandbox's own clock, never the recorded one. */
function contentResult(commandId: string, actionType: WebAutomationActionResult["actionType"], overrides: Partial<WebAutomationActionResult> = {}): WebAutomationActionResult {
  return {
    commandId,
    actionType,
    status: "succeeded",
    validation: { status: "passed" } as WebAutomationActionResult["validation"],
    url: PAGE_URL,
    extracted: [{ name: "One" }],
    extraction: summary(),
    startedAt: 90_000,
    finishedAt: 90_050,
    ...overrides
  };
}

/** The recorded result, built as the live background built it: the builder, the worker's tab, the trace references. */
function recordedResult(overrides: Partial<WebAutomationActionResult> = {}, actionType: WebAutomationActionResult["actionType"] = "web.dom.extract_list"): ClientGatewayActionResult {
  const built = gatewayActionResultFromBrowserResult(contentResult(RECORDED_ID, actionType, { startedAt: 1_000, finishedAt: 1_400, ...overrides }), { tabId: 3 });
  return { ...built, metadata: { trace: TRACE_METADATA } };
}

function request(overrides: Partial<ClientGatewayTraceReevaluationRequest> = {}): ClientGatewayTraceReevaluationRequest {
  const compared = { actionType: "web.dom.extract_list", target: null, parameters: LIST_COMMAND.parameters };
  return {
    traceId: "trace-1",
    command: LIST_COMMAND,
    operation: { actionType: "web.dom.extract_list", compared, key: JSON.stringify(compared) },
    recorded: { actionType: "web.dom.extract_list", compared, key: "recorded", sequence: 4, logicalMs: 2_000, commandId: RECORDED_ID, session: "s-1", redacted: false },
    recordedCommand: RECORDED_LIST_COMMAND,
    fields: ["parameters.extractList.where"],
    recordedResult: recordedResult(),
    artifacts: [
      { id: "art-1", sha256: PRIMARY, mediaType: "text/html", sequence: 5 },
      { id: "art-2", sha256: STYLE, mediaType: "text/css", sequence: 6 }
    ],
    readArtifact: async (sha256) => STORE[sha256],
    ...overrides
  };
}

type Run = { result?: Partial<WebAutomationActionResult>; observations?: Partial<WebSnapshotSandboxObservations> } | WebSnapshotPageEvaluation;
type FakePage = WebSnapshotPage & { calls: Array<{ snapshot: WebPageSnapshot; action: WebAutomationActionCommand }> };

/** A sandbox that answers the control (the recorded command id) and the changed read each as told; both default to the recorded read's page. */
function fakePage(runs: { changed?: Run; control?: Run } = {}): FakePage {
  const calls: FakePage["calls"] = [];
  return {
    calls,
    evaluate: async (snapshot, action) => {
      calls.push({ snapshot, action });
      const run = (action.commandId === RECORDED_ID ? runs.control : runs.changed) ?? {};
      if ("status" in run) return run;
      return { status: "evaluated", result: contentResult(action.commandId, action.actionType, run.result), observations: { ...ONE_REVEAL, ...run.observations } };
    }
  };
}

function reevaluator(page: WebSnapshotPage): ClientGatewayTraceReevaluator {
  return createWebOfflineReadReevaluator(page);
}

const FIELDS = ["parameters.extractList.where"];
const GAP_DYNAMIC = { status: "gap", reason: "dynamic_content", fields: FIELDS };
const GAP_SNAPSHOT = { status: "gap", reason: "snapshot_unavailable", fields: FIELDS };
const GAP_CAPTURE = { status: "gap", reason: "incomplete_capture", fields: FIELDS };

function answeredPayload(answer: Awaited<ReturnType<ClientGatewayTraceReevaluator["reevaluate"]>>): JsonObject | undefined {
  return answer.status === "answered" ? (answer.result.payload as JsonObject | undefined) : undefined;
}

test("a changed read whose control reproduces the recorded read is answered: the builder's result with the recorded timings, source and trace kept", async () => {
  const page = fakePage();
  const answer = await reevaluator(page).reevaluate(request());

  assert.equal(page.calls.length, 2, "the control and the changed read, over the same snapshot");
  const control = page.calls.find((call) => call.action.commandId === RECORDED_ID);
  const changed = page.calls.find((call) => call.action.commandId === TRIAL_ID);
  assert.ok(control && changed);
  assert.equal(control.snapshot, changed.snapshot);
  assert.equal(control.action.extractList?.where, undefined, "the control runs the recorded command");
  assert.deepEqual(changed.action.extractList?.where, [{ field: "name", contains: ["One"] }], "the changed request runs (as the domain reads it)");
  assert.equal(changed.snapshot.url, PAGE_URL, "the page loads at the primary artifact's own address");
  assert.equal(changed.snapshot.primary.sha256, PRIMARY);
  assert.deepEqual(changed.snapshot.primary.bytes, STORE[PRIMARY]);
  assert.deepEqual(changed.snapshot.resources.map((part) => [part.sha256, part.source]), [[STYLE, "https://shop.example.test/site.css"]]);
  assert.equal(changed.snapshot.unavailable, 2, "the recorded count plus the resource the segment does not hold");

  // The payload equals what the domain's builder makes for the changed read's
  // content result, with the recorded read's timings, tab and trace.
  const expected = gatewayActionResultFromBrowserResult(contentResult(TRIAL_ID, "web.dom.extract_list", { startedAt: 1_000, finishedAt: 1_400 }));
  assert.deepEqual(answer, {
    status: "answered",
    result: { ...expected, payload: { ...expected.payload, sourceId: "tab:3:frame:0" }, metadata: { trace: TRACE_METADATA } }
  });
});

test("a recorded read that failed with its rows (output not observed) is answered when the control reproduces it", async () => {
  const failedWithRows: Partial<WebAutomationActionResult> = { status: "failed", failure: OUTPUT_NOT_OBSERVED, message: "Missing field.", extracted: [{ name: "One" }, { name: "Two" }], extraction: summary({ recordCount: 2, itemsSeen: 2 }) };
  const filtered: Partial<WebAutomationActionResult> = { ...failedWithRows, extracted: [{ name: "One" }], extraction: summary({ itemsSeen: 2 }) };
  const page = fakePage({ control: { result: failedWithRows }, changed: { result: filtered } });
  const answer = await reevaluator(page).reevaluate(request({ recordedResult: recordedResult(failedWithRows) }));
  assert.equal(answer.status, "answered");
  assert.equal(answer.status === "answered" ? answer.result.status : undefined, "failed");
  assert.deepEqual(answeredPayload(answer)?.extracted, [{ name: "One" }]);
});

test("a control that does not reproduce the recorded read gives dynamic_content, whatever the changed read returned", async () => {
  const cases: Array<[string, Partial<WebAutomationActionResult>]> = [
    ["another status", { status: "failed", failure: OUTPUT_NOT_OBSERVED }],
    ["other rows", { extracted: [{ name: "Uno" }] }],
    ["fewer rows", { extracted: [], extraction: summary({ recordCount: 0 }) }],
    ["another count in the summary", { extraction: summary({ itemsSeen: 4 }) }],
    ["no summary where the recorded read had one", { extraction: undefined }]
  ];
  for (const [label, result] of cases) {
    assert.deepEqual(await reevaluator(fakePage({ control: { result } })).reevaluate(request()), GAP_DYNAMIC, label);
  }
  const failedRecorded = recordedResult({ status: "failed", failure: OUTPUT_NOT_OBSERVED });
  const otherCode: Failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);
  assert.deepEqual(await reevaluator(fakePage({ control: { result: { status: "failed", failure: otherCode } } })).reevaluate(request({ recordedResult: failedRecorded })), GAP_DYNAMIC, "same status, another failure code");
});

test("timings, addresses and ids never count against the control", async () => {
  const page = fakePage({ control: { result: { startedAt: 5, finishedAt: 7, url: "https://elsewhere.example.test/", title: "Other" } } });
  assert.equal((await reevaluator(page).reevaluate(request())).status, "answered");
});

test("a changed read that asks the page for more than the control did gives dynamic_content", async () => {
  const cases: Array<[string, Run, Run]> = [
    ["scrolls past the end once more", { observations: { scrollsPastEnd: 2 } }, { observations: { scrollsPastEnd: 1 } }],
    ["scrolls where the control did not", { observations: { scrollsPastEnd: 1 } }, { observations: { scrollsPastEnd: 0 } }],
    ["a navigation held", { observations: { navigationsHeld: 1 } }, {}]
  ];
  // The recorded read here proves nothing about its list's end (it was cut short by a bound).
  const truncated = summary({ truncated: true });
  for (const [label, changed, control] of cases) {
    const page = fakePage({ changed, control: { ...control, result: { extraction: truncated } } });
    assert.deepEqual(await reevaluator(page).reevaluate(request({ recordedResult: recordedResult({ extraction: truncated }) })), GAP_DYNAMIC, label);
  }
});

test("a changed read that asks no more than the control did is answered", async () => {
  const truncated = summary({ truncated: true });
  const cases: Array<[string, Partial<WebSnapshotSandboxObservations>, Partial<WebSnapshotSandboxObservations>]> = [
    ["one reveal each", { scrollsPastEnd: 1 }, { scrollsPastEnd: 1 }],
    ["equal scrolls and navigations", { scrollsPastEnd: 3, navigationsHeld: 1 }, { scrollsPastEnd: 3, navigationsHeld: 1 }],
    ["fewer than the control", { scrollsPastEnd: 0 }, { scrollsPastEnd: 1 }]
  ];
  for (const [label, changed, control] of cases) {
    const page = fakePage({ changed: { observations: changed }, control: { observations: control, result: { extraction: truncated } } });
    assert.equal((await reevaluator(page).reevaluate(request({ recordedResult: recordedResult({ extraction: truncated }) }))).status, "answered", label);
  }
});

test("a changed read that asks for more still stands when the recorded read proves its list ended where the snapshot ends", async () => {
  const more: Run = { observations: { scrollsPastEnd: 2, navigationsHeld: 1 } };
  const proofs: Array<[string, Extraction]> = [
    ["one page read whole, no way on", summary()],
    ["next control disabled on page one", summary({ paginationStop: "control_disabled" })],
    ["scrolled to the end", summary({ pagesRead: 6, paginationStop: "scrolled_to_end" })]
  ];
  for (const [label, extraction] of proofs) {
    const page = fakePage({ changed: more, control: { result: { extraction } } });
    assert.equal((await reevaluator(page).reevaluate(request({ recordedResult: recordedResult({ extraction }) }))).status, "answered", label);
  }
  const unproven: Array<[string, Extraction]> = [
    ["list continues", summary({ listContinues: { kind: "infinite_scroll", evidence: "still_growing" } })],
    ["paged by a control", summary({ pagesRead: 3, paginationStop: "control_disabled" })],
    ["stopped by a bound", summary({ paginationStop: "page_limit" })]
  ];
  for (const [label, extraction] of unproven) {
    const page = fakePage({ changed: more, control: { result: { extraction } } });
    assert.deepEqual(await reevaluator(page).reevaluate(request({ recordedResult: recordedResult({ extraction }) })), GAP_DYNAMIC, label);
  }
  const failedRecorded: Partial<WebAutomationActionResult> = { status: "failed", failure: OUTPUT_NOT_OBSERVED };
  const page = fakePage({ changed: more, control: { result: failedRecorded } });
  assert.deepEqual(await reevaluator(page).reevaluate(request({ recordedResult: recordedResult(failedRecorded) })), GAP_DYNAMIC, "a recorded read that failed proves no end");
});

test("no readable recorded command gives incomplete_capture, without touching the page", async () => {
  const page = fakePage();
  const cases: Array<[string, ClientGatewayTraceReevaluationRequest["recordedCommand"]]> = [
    ["withheld or unreadable", null],
    ["no command id", { actionType: "web.dom.extract_list" }],
    ["an action type that is not a string", { commandId: RECORDED_ID, actionType: 7 }],
    ["parameters that are not an object", { commandId: RECORDED_ID, actionType: "web.dom.extract_list", parameters: [1] }],
    ["a target that is not an object", { commandId: RECORDED_ID, actionType: "web.dom.extract_list", target: "#list" }],
    ["a timeout that is not a number", { commandId: RECORDED_ID, actionType: "web.dom.extract_list", timeoutMs: "soon" }],
    ["a command the domain rejects", { commandId: RECORDED_ID, actionType: "web.dom.unknown_verb" }],
    ["another action than the changed read's", { commandId: RECORDED_ID, actionType: "web.dom.extract", target: { selector: "#total" } }]
  ];
  for (const [label, recordedCommand] of cases) {
    assert.deepEqual(await reevaluator(page).reevaluate(request({ recordedCommand })), GAP_CAPTURE, label);
  }
  assert.equal(page.calls.length, 0);
});

test("a sandbox breach in either run is never a pass: dynamic_content", async () => {
  for (const observations of [{ scriptsRan: 1 }, { requestsLeaked: 2 }]) {
    assert.deepEqual(await reevaluator(fakePage({ changed: { observations } })).reevaluate(request()), GAP_DYNAMIC, `changed ${JSON.stringify(observations)}`);
    assert.deepEqual(await reevaluator(fakePage({ control: { observations } })).reevaluate(request()), GAP_DYNAMIC, `control ${JSON.stringify(observations)}`);
  }
});

test("a refused request alone is not dynamic: the snapshot simply did not hold that address", async () => {
  const page = fakePage({ changed: { observations: { requestsRefused: 3 } } });
  assert.equal((await reevaluator(page).reevaluate(request())).status, "answered");
});

test("rows a filter excluded are the read's honest answer, not a gap", async () => {
  const page = fakePage({ changed: { result: { extracted: [], extraction: summary({ recordCount: 0, itemsSeen: 4 }) } } });
  const answer = await reevaluator(page).reevaluate(request());
  assert.equal(answer.status, "answered");
  assert.deepEqual(answeredPayload(answer)?.extracted, []);
});

test("an act is declined without touching the page, as is a difference outside parameters and target or an unreadable command", async () => {
  const page = fakePage();
  const reevaluate = reevaluator(page);
  const click = { commandId: "cmd-trial-2", actionType: "web.dom.click", target: { selector: "#next" } };
  assert.deepEqual(await reevaluate.reevaluate(request({ command: click, fields: ["target.selector"] })), { status: "declined" });
  const nextPage = { commandId: "cmd-trial-3", actionType: "web.dom.next_page", parameters: { nextPage: { list: "ul" } } };
  assert.deepEqual(await reevaluate.reevaluate(request({ command: nextPage, fields: ["parameters.nextPage"] })), { status: "declined" }, "a move to the next page is a lasting act");
  for (const fields of [["actionType"], ["operation"], ["parameters", "metadata.flag"], [], ["parametersX"]]) {
    assert.deepEqual(await reevaluate.reevaluate(request({ fields })), { status: "declined" }, JSON.stringify(fields));
  }
  assert.deepEqual(await reevaluate.reevaluate(request({ command: { commandId: "cmd-x", actionType: "web.dom.unknown_verb" } })), { status: "declined" }, "a command the domain rejects never reaches the page");
  assert.deepEqual(await reevaluate.reevaluate(request({ command: { actionType: "web.dom.extract_list" } })), { status: "declined" }, "a command with no id is not one the domain reads");
  assert.equal(page.calls.length, 0);
});

test("a read of another observational type is eligible: a single-value read with a changed target", async () => {
  const value: Partial<WebAutomationActionResult> = { extracted: "12.00", extraction: undefined };
  const page = fakePage({ changed: { result: value }, control: { result: value } });
  const extract = { commandId: "cmd-trial-4", actionType: "web.dom.extract", target: { selector: "#total" } };
  const recordedCommand = { commandId: RECORDED_ID, actionType: "web.dom.extract", target: { selector: "#sum" } };
  const answer = await reevaluator(page).reevaluate(request({ command: extract, recordedCommand, fields: ["target.selector"], recordedResult: recordedResult(value, "web.dom.extract") }));
  assert.equal(answer.status, "answered");
  assert.equal(page.calls.find((call) => call.action.commandId === "cmd-trial-4")?.action.selector, "#total");
  assert.equal(page.calls.find((call) => call.action.commandId === RECORDED_ID)?.action.selector, "#sum");
});

test("no trace references, no primary, a primary outside the segment, or unreadable bytes: snapshot_unavailable", async () => {
  const page = fakePage();
  const reevaluate = reevaluator(page);
  const withTrace = (trace: unknown): ClientGatewayActionResult => ({ ...recordedResult(), metadata: trace === undefined ? {} : { trace: trace as JsonObject } });
  const cases: Array<[string, Partial<ClientGatewayTraceReevaluationRequest>]> = [
    ["no trace metadata", { recordedResult: withTrace(undefined) }],
    ["malformed trace metadata", { recordedResult: withTrace({ artifacts: "none", unavailable: 0 }) }],
    ["no primary artifact", { recordedResult: withTrace({ artifacts: [{ sha256: STYLE, mediaType: "text/css", byteLength: 4, role: "resource", source: "x" }], unavailable: 0 }) }],
    ["a primary with no address", { recordedResult: withTrace({ artifacts: [{ sha256: PRIMARY, mediaType: "text/html", byteLength: 60, role: "primary" }], unavailable: 0 }) }],
    ["a primary recorded after the segment", { recordedResult: withTrace({ artifacts: [{ sha256: LATER, mediaType: "text/html", byteLength: 18, role: "primary", source: PAGE_URL }], unavailable: 0 }) }],
    ["primary bytes missing from the store", { readArtifact: async () => undefined }],
    ["resource bytes present but primary missing", { readArtifact: async (sha256) => (sha256 === PRIMARY ? undefined : STORE[sha256]) }]
  ];
  for (const [label, overrides] of cases) {
    assert.deepEqual(await reevaluate.reevaluate(request(overrides)), GAP_SNAPSHOT, label);
  }
  assert.equal(page.calls.length, 0, "the page is never asked without a snapshot");
});

test("a store that throws is not read as a missing snapshot: the failure reaches the matcher, which answers it as a gap with its message", async () => {
  const page = fakePage();
  const reevaluate = reevaluator(page);
  await assert.rejects(reevaluate.reevaluate(request({ readArtifact: async () => { throw new Error("store offline"); } })), /store offline/);
  const failingResource = async (sha256: string): Promise<Uint8Array | undefined> => {
    if (sha256 === STYLE) throw new Error("resource read failed");
    return STORE[sha256];
  };
  await assert.rejects(reevaluate.reevaluate(request({ readArtifact: failingResource })), /resource read failed/);
  assert.equal(page.calls.length, 0);
});

test("a page that could not run the snapshot, for either run, gives its own reason", async () => {
  for (const reason of ["snapshot_unavailable", "dynamic_content"] as const) {
    const unavailable: WebSnapshotPageEvaluation = { status: "unavailable", reason, detail: "could not start" };
    assert.deepEqual(await reevaluator(fakePage({ changed: unavailable })).reevaluate(request()), { status: "gap", reason, fields: FIELDS }, `changed ${reason}`);
    assert.deepEqual(await reevaluator(fakePage({ control: unavailable })).reevaluate(request()), { status: "gap", reason, fields: FIELDS }, `control ${reason}`);
  }
});

test("a target the changed read needs that resolves to nothing offline gives dynamic_content", async () => {
  const notFound: Failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  const notShown: Failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN);
  const cases: Array<[string, Partial<WebAutomationActionResult>]> = [
    ["target not found", { status: "failed", failure: notFound }],
    ["target not shown", { status: "failed", failure: notShown }],
    ["the wait ran out", { status: "timed_out" }],
    ["the list never appeared", { extracted: [], extraction: summary({ recordCount: 0, itemsSeen: 0, listPresence: "never_appeared" }) }]
  ];
  for (const [label, result] of cases) {
    assert.deepEqual(await reevaluator(fakePage({ changed: { result } })).reevaluate(request()), GAP_DYNAMIC, label);
  }
});

test("a changed read that failed on the page for another reason is answered as it failed", async () => {
  const page = fakePage({ changed: { result: { status: "failed", failure: OUTPUT_NOT_OBSERVED, message: "Missing field." } } });
  const answer = await reevaluator(page).reevaluate(request());
  assert.equal(answer.status, "answered");
  assert.equal(answer.status === "answered" ? answer.result.status : undefined, "failed");
});

test("a changed read needing unsupported automatic disclosure is a gap, including the default", async () => {
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, { actual: "incomplete_text: field description contains unexpanded text" });
  for (const discloseText of [undefined, true]) {
    const extractList = { ...LIST_COMMAND.parameters.extractList, ...(discloseText !== undefined ? { discloseText } : {}) };
    const command = { ...LIST_COMMAND, parameters: { extractList } };
    const page = fakePage({ changed: { result: { status: "failed", failure } } });
    assert.deepEqual(await reevaluator(page).reevaluate(request({ command })), GAP_DYNAMIC);
    assert.equal(page.calls.length, 2, "only isolated control/changed evaluation, with no live fallback");
  }
});

test("a reproducing control that also needs unsupported disclosure cannot vouch for the snapshot", async () => {
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, { actual: "incomplete_text: field description contains unexpanded text" });
  const result: Partial<WebAutomationActionResult> = { status: "failed", failure };
  const page = fakePage({ control: { result } });
  assert.deepEqual(await reevaluator(page).reevaluate(request({ recordedResult: recordedResult(result) })), GAP_DYNAMIC);
});

test("explicit disclosure opt-out preserves a deliberate incomplete-text failure", async () => {
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, { actual: "incomplete_text: field description contains unexpanded text" });
  const extractList = { ...LIST_COMMAND.parameters.extractList, discloseText: false };
  const page = fakePage({ changed: { result: { status: "failed", failure } } });
  const answer = await reevaluator(page).reevaluate(request({ command: { ...LIST_COMMAND, parameters: { extractList } } }));
  assert.equal(answer.status, "answered");
  assert.equal(answer.status === "answered" ? answer.result.status : undefined, "failed");
  assert.equal(page.calls[1]?.action.extractList?.discloseText, false, "the domain preserves opt-out");
});

test("complete captured text needs no disclosure and remains an answer", async () => {
  const page = fakePage({ changed: { result: { extracted: [{ description: "A complete captured description." }] } } });
  const answer = await reevaluator(page).reevaluate(request());
  assert.equal(answer.status, "answered");
  assert.deepEqual(answeredPayload(answer)?.extracted, [{ description: "A complete captured description." }]);
});
