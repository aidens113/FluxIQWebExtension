import assert from "node:assert/strict";
import test from "node:test";

import { PANEL_REPORT_PROBLEM_MESSAGE, type BrowserDescriptor, type ExtensionStatus, type FluxIQSettings, type PanelRelayResponse, type ProblemLogEntry, type ProblemReport } from "../../../shared/protocol";
import { browserIdentity, MAXIMUM_PROBLEM_LOG_ENTRIES, ProblemLog, ProblemNoticer, type ProblemLogStore } from "../problem/index";
import { readRecentRuns } from "../recent-runs";
import { handleReportProblem, type ReportProblemDeps } from "../report-problem-control";

const TOKEN = "pairing-token-SECRET-0001";
const CODE = "ABCD-1234";

const settings: FluxIQSettings = {
  gatewayUrl: "ws://127.0.0.1:4711/client?token=leak",
  coreApiUrl: "http://127.0.0.1:3000/app/path",
  autoReconnect: true,
  captureMutations: true,
  captureInputValues: true,
  captureSnapshots: true,
  requestsEnabled: false
};

const browser: BrowserDescriptor = {
  clientKind: "browser_extension",
  clientName: "FluxIQ Browser Extension",
  extensionVersion: "0.1.0",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
  language: "en-US",
  platform: "Win32",
  timezone: "America/Los_Angeles"
};

function status(): ExtensionStatus {
  return {
    connectionState: "reconnecting",
    recordingState: "recording",
    gatewayUrl: settings.gatewayUrl,
    settings,
    clientId: "extension-1",
    paired: true,
    sessionId: "session-1",
    projectId: "project-1",
    activeTabId: 7,
    activeTabUrl: "https://bank.example/account?id=42",
    queueSize: 3,
    pairingReferenceCode: CODE,
    eventCount: 12,
    recordingStartedAt: 1000,
    recentActivities: [{ id: "a1", timestamp: 2000, kind: "click", label: "Clicked \"Pay 4111 1111 1111 1111\"", detail: "https://bank.example/pay", tone: "success" }],
    runtime: { state: "failed", commandId: "command-9", actionType: "web.dom.type", label: "Type", target: "#password", error: `Could not type "hunter2" into #password (Bearer ${TOKEN})`, url: "https://bank.example/login", startedAt: 3000, finishedAt: 3100 },
    lastError: `Refused pairing ${CODE} at http://127.0.0.1:4711/client?token=${TOKEN}`
  };
}

function memoryStore(initial: unknown = undefined): ProblemLogStore & { value: unknown } {
  const store = {
    value: initial,
    read: async () => store.value,
    write: async (entries: ProblemLogEntry[]) => { store.value = entries; }
  };
  return store;
}

function deps(overrides: Partial<ReportProblemDeps> = {}): ReportProblemDeps {
  const log = new ProblemLog(memoryStore([{ at: 1, source: "connection", message: `old failure quoting ${TOKEN}` }]));
  return {
    isControlPage: () => true,
    status: async () => status(),
    settings: () => settings,
    browser: () => browser,
    problems: log,
    call: async () => ({ ok: true, payload: { runtimeSessions: [{ runId: "run-1", status: "failed", flowId: "flow-1", targetKind: "flow", targetId: "flow-1", startedAt: 5, finishedAt: 6, attemptCount: 2, inputs: { password: "hunter2" } }] } }),
    projectId: () => "project-1",
    token: () => TOKEN,
    now: () => Date.UTC(2026, 8, 29),
    ...overrides
  };
}

async function report(overrides: Partial<ReportProblemDeps> = {}): Promise<ProblemReport> {
  const answer = await handleReportProblem({ type: PANEL_REPORT_PROBLEM_MESSAGE }, {} as chrome.runtime.MessageSender, deps(overrides));
  assert.equal(answer.handled, true);
  const response = (answer as { response: { ok: boolean; report: ProblemReport } }).response;
  assert.equal(response.ok, true);
  return response.report;
}

test("a report carries versions, ids, states and recent runs", async () => {
  const bundle = await report();
  assert.equal(bundle.schema, "fluxiq.problem-report/1");
  assert.equal(bundle.createdAt, "2026-09-29T00:00:00.000Z");
  assert.deepEqual(bundle.extension, { version: "0.1.0", browser: "Edge", browserVersion: "129", platform: "Win32", language: "en-US" });
  assert.equal(bundle.connection.gatewayOrigin, "ws://127.0.0.1:4711");
  assert.equal(bundle.connection.coreOrigin, "http://127.0.0.1:3000");
  assert.deepEqual(bundle.session, { clientId: "extension-1", sessionId: "session-1", projectId: "project-1" });
  assert.deepEqual(bundle.recording, { state: "recording", eventCount: 12, startedAt: 1000 });
  assert.equal(bundle.runtime.state, "failed");
  assert.equal(bundle.runtime.commandId, "command-9");
  assert.deepEqual(bundle.recentActivity, [{ at: 2000, kind: "click", tone: "success" }]);
  assert.deepEqual(bundle.recentRuns, { available: true, runs: [{ runId: "run-1", status: "failed", targetKind: "flow", flowId: "flow-1", startedAt: 5, finishedAt: 6, attemptCount: 2 }] });
  assert.ok(bundle.withheld.length > 0);
});

test("a report never carries the token, the pairing code, page addresses, page text or typed values", async () => {
  const text = JSON.stringify(await report());
  for (const leak of [TOKEN, CODE, "hunter2", "bank.example", "4111", "account?id", "token=leak", "#password\"", "/app/path"]) {
    assert.ok(!text.includes(leak), `report leaked ${leak}: ${text}`);
  }
});

test("a report is still made when FluxIQ cannot be asked for runs, and says why", async () => {
  const unreachable: PanelRelayResponse = { ok: false, code: "unreachable", error: "FluxIQ could not be reached." };
  const bundle = await report({ call: async () => unreachable });
  assert.deepEqual(bundle.recentRuns, { available: false, reason: "unreachable: FluxIQ could not be reached." });
  const thrown = await report({ call: async () => { throw new Error(`boom Bearer ${TOKEN}`); } });
  assert.equal(thrown.recentRuns.available, false);
  assert.ok(!JSON.stringify(thrown).includes(TOKEN));
  assert.deepEqual(await readRecentRuns(async () => unreachable, undefined), { available: false, reason: "FluxIQ has not said which project this browser belongs to." });
});

test("only the side panel or the popup may ask for a report; other messages are not handled", async () => {
  const refused = await handleReportProblem({ type: PANEL_REPORT_PROBLEM_MESSAGE }, {} as chrome.runtime.MessageSender, deps({ isControlPage: () => false }));
  assert.deepEqual(refused, { handled: true, response: { ok: false, code: "forbidden", error: "Only the FluxIQ panel can do that." } });
  assert.deepEqual(await handleReportProblem({ type: "fluxiq.getStatus" }, {} as chrome.runtime.MessageSender, deps()), { handled: false });
});

test("the problem log redacts on write, drops malformed entries, skips an immediate repeat and stays bounded", async () => {
  const store = memoryStore([{ at: 0, source: "connection", message: "kept" }, { nope: true }, "junk"]);
  const log = new ProblemLog(store, () => [TOKEN], () => 42);
  await log.note({ source: "connection", message: `refused ${TOKEN}` });
  await log.note({ source: "connection", message: `refused ${TOKEN}` });
  const entries = await log.recent();
  assert.deepEqual(entries, [{ at: 0, source: "connection", message: "kept" }, { at: 42, source: "connection", message: "refused [withheld]" }]);
  for (let index = 0; index < MAXIMUM_PROBLEM_LOG_ENTRIES + 5; index += 1) await log.note({ source: "action", message: `failure ${index}` });
  assert.equal((await log.recent()).length, MAXIMUM_PROBLEM_LOG_ENTRIES);
  assert.deepEqual(await new ProblemLog(memoryStore("not a list")).recent(), []);
});

test("a problem log whose storage fails does not fail a note, and a report says the log was unreadable", async () => {
  const log = new ProblemLog({ read: async () => { throw new Error("gone"); }, write: async () => { throw new Error("gone"); } });
  await log.note({ source: "message", message: "x" });
  await assert.rejects(log.recent(), /gone/);
  const bundle = await report({ problems: log });
  assert.equal(bundle.recentProblems.length, 1);
  assert.match(bundle.recentProblems[0]?.message ?? "", /problem log could not be read: gone/);
});

test("the noticer notes a new error and a failed command once each", () => {
  const noted: string[] = [];
  const noticer = new ProblemNoticer((input) => noted.push(`${input.source}:${input.message}`));
  noticer.observe({ lastError: "socket failed" });
  noticer.observe({ lastError: "socket failed" });
  noticer.observe({ lastError: undefined });
  noticer.observe({ lastError: "socket failed" });
  const failed = { state: "failed" as const, commandId: "c1", finishedAt: 5, error: "no element" };
  noticer.observe({ runtime: failed });
  noticer.observe({ runtime: failed });
  assert.deepEqual(noted, ["connection:socket failed", "connection:socket failed", "action:no element"]);
});

test("browser identity names the browser and its major version only", () => {
  assert.deepEqual(browserIdentity("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0"), { name: "Firefox", version: "131" });
  assert.deepEqual(browserIdentity("Mozilla/5.0 Chrome/128.0.1.2 Safari/537.36"), { name: "Chrome", version: "128" });
  assert.deepEqual(browserIdentity("curl/8"), { name: "Unknown" });
});
