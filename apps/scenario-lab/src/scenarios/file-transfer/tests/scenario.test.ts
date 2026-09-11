import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab } from "../../../server.js";
import type { ScenarioRouteRequest, ScenarioRouteResponse } from "../../../types.js";
import { fileTransferScenario } from "../scenario.js";
import type { FileTransferState } from "../state.js";

const TOKEN = "file-transfer-run-token-0119";
const REPORT_119 = "region,orders,revenue\r\nNorth,23,667.00\r\nSouth,44,968.00\r\nEast,65,975.00\r\nWest,86,2236.00\r\n";
const { manifest } = fileTransferScenario;
const create = (seed: number) => fileTransferScenario.createState(seed);
const mutate = (state: FileTransferState, operation: string, payload: unknown) => fileTransferScenario.mutate(state, operation, payload);
const render = (state: FileTransferState) => fileTransferScenario.render(state, { runToken: TOKEN, seed: state.seed });

function route(state: FileTransferState, subpath: string, method: ScenarioRouteRequest["method"] = "GET"): ScenarioRouteResponse | undefined {
  assert.ok(fileTransferScenario.route, "file-transfer serves routes");
  return fileTransferScenario.route(state, { subpath, query: new URLSearchParams(), method }, { runToken: TOKEN, seed: state.seed });
}

function steps(script: readonly ScenarioStep[]): Array<[string, string | null, unknown]> {
  return script.map(({ operation, target, value }) => [operation, target ?? null, value ?? null]);
}

test("manifest is valid and keeps the placeholder's export, id, seed, and start path", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual([fileTransferScenario.id, fileTransferScenario.seed, fileTransferScenario.startPath], ["file-transfer", 119, "/scenarios/file-transfer/"]);
  assert.deepEqual([manifest.id, manifest.seed, manifest.startPath, manifest.networkPolicy], ["file-transfer", 119, "/scenarios/file-transfer/", "loopback-only"]);
  assert.deepEqual(manifest.capabilities, ["download", "forms", "mutation"]);
});

test("primary workflow W16 clicks the download link, waits for report-119.csv, then for the recorded status", () => {
  const primary = resolveScenarioWorkflow(manifest);
  assert.equal(primary.workflowId, undefined);
  assert.equal(primary.variant, undefined);
  assert.deepEqual(steps(primary.recordingScript), [
    ["click", "testid:download-report", null],
    ["waitForDownload", null, "report-119.csv"],
    ["waitForState", "testid:download-recorded", null],
  ]);
  assert.deepEqual(primary.expected.finalState, [{ id: "report-downloaded", subject: "download-recorded", predicate: "text", value: "Downloaded report-119.csv" }]);
  assert.deepEqual(primary.expected.actions, [{ action: "web.dom.click", outcome: "succeeded" }]);
  assert.deepEqual(primary.expected.allowedConsoleErrors, []);
});

test("upload workflow W17 uploads a named file, submits, and waits for the echo; no workflow has variants", () => {
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["upload"]);
  const upload = resolveScenarioWorkflow(manifest, { workflowId: "upload" });
  assert.deepEqual(steps(upload.recordingScript), [
    ["upload", "testid:upload-file", "expense-receipts.csv"],
    ["click", "testid:upload-submit", null],
    ["waitForState", "testid:upload-result", null],
  ]);
  assert.deepEqual(upload.expected.finalState, [{ id: "upload-echoed", subject: "upload-result", predicate: "text", value: "Uploaded expense-receipts.csv" }]);
  assert.equal(manifest.variants, undefined);
  assert.deepEqual(manifest.workflows?.map(({ variants }) => variants), [undefined]);
  assert.throws(() => resolveScenarioWorkflow(manifest, { variantId: "any" }), /has no variant any/);
});

test("the start page carries every testid a script step or page fact names, with labelled controls", () => {
  const html = render(create(119));
  const targets = [manifest, ...(manifest.workflows ?? [])].flatMap(({ recordingScript }) => recordingScript)
    .flatMap(({ target }) => (target?.startsWith("testid:") ? [target.slice("testid:".length)] : []));
  const statusLines = new Set(["download-recorded", "upload-result"]);
  for (const testId of targets.filter((id) => !statusLines.has(id))) assert.match(html, new RegExp(`data-testid="${testId}"`), testId);
  for (const testId of statusLines) assert.doesNotMatch(html, new RegExp(`data-testid="${testId}"`), testId);
  assert.match(html, /<h1>File transfer<\/h1>/);
  assert.match(html, /<a data-testid="download-report" href="\/scenarios\/file-transfer\/report\.csv">Download report<\/a>/);
  assert.match(html, /<code data-testid="report-filename">report-119\.csv<\/code>/);
  assert.match(html, /<label for="upload-file">File to upload<\/label>\s*<input id="upload-file" name="file" type="file" data-testid="upload-file"/);
  assert.match(html, /<button type="submit" data-testid="upload-submit">Upload<\/button>/);
  assert.doesNotMatch(html, /Math\.random|Date\.now|new Date/);
});

test("state, report, and page are deterministic from the seed", () => {
  assert.deepEqual(create(119), { seed: 119, reportFilename: "report-119.csv", downloadCount: 0, uploadCount: 0, lastUpload: null });
  assert.deepEqual(create(119), create(119));
  assert.equal(create(42).reportFilename, "report-42.csv");
  assert.equal(route(create(119), "report.csv")?.body, REPORT_119);
  assert.equal(route(create(119), "report.csv")?.body, route(create(119), "report.csv")?.body);
  assert.notEqual(route(create(42), "report.csv")?.body, REPORT_119);
  assert.equal(render(create(119)), render(create(119)));
});

test("record-download counts only the served report and never edits state in place", () => {
  const initial = create(119);
  const once = mutate(initial, "record-download", { filename: "report-119.csv" });
  assert.deepEqual(once, { ...initial, downloadCount: 1 });
  assert.equal(initial.downloadCount, 0);
  assert.equal(mutate(once, "record-download", { filename: "report-119.csv" }).downloadCount, 2);
  for (const payload of [{ filename: "report-42.csv" }, {}, "report-119.csv", null]) assert.equal(mutate(once, "record-download", payload), once, JSON.stringify(payload));
});

test("upload records only a valid name and size and ignores malformed payloads", () => {
  const initial = create(119);
  const uploaded = mutate(initial, "upload", { name: "expense-receipts.csv", size: 31, contents: "SYNTHETIC_FILE_BODY" });
  assert.deepEqual(uploaded, { ...initial, uploadCount: 1, lastUpload: { name: "expense-receipts.csv", size: 31 } });
  assert.equal(JSON.stringify(uploaded).includes("SYNTHETIC_FILE_BODY"), false);
  const invalid: unknown[] = [
    undefined, null, [], {}, { name: "", size: 1 }, { name: "a".repeat(256), size: 1 }, { name: "dir/evil.csv", size: 1 },
    { name: "dir\\evil.csv", size: 1 }, { name: "a.csv" }, { name: "a.csv", size: -1 }, { name: "a.csv", size: 1.5 },
    { name: "a.csv", size: "1" }, { name: 7, size: 1 },
  ];
  for (const payload of invalid) assert.equal(mutate(uploaded, "upload", payload), uploaded, JSON.stringify(payload));
  const second = mutate(uploaded, "upload", { name: "empty.txt", size: 0 });
  assert.deepEqual([second.uploadCount, second.lastUpload], [2, { name: "empty.txt", size: 0 }]);
});

test("unknown operations leave state unchanged", () => {
  const initial = create(119);
  for (const operation of ["download", "reset", "record-upload", ""]) assert.equal(mutate(initial, operation, { filename: "report-119.csv", name: "a.csv", size: 1 }), initial, operation);
});

test("routes serve the report as an attachment, answer download status, and 404 anything else", () => {
  const initial = create(119);
  const report = route(initial, "report.csv");
  assert.deepEqual(report, {
    status: 200,
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="report-119.csv"' },
    body: REPORT_119,
    mutation: { operation: "record-download", payload: { filename: "report-119.csv" } },
  });
  assert.deepEqual(route(initial, "report.csv", "HEAD"), report);
  const status = route(mutate(initial, "record-download", { filename: "report-119.csv" }), "download-status");
  assert.equal(status?.status, 200);
  assert.deepEqual(status?.headers, { "content-type": "application/json; charset=utf-8" });
  assert.equal(status?.mutation, undefined);
  assert.deepEqual(JSON.parse(status?.body ?? "null"), { filename: "report-119.csv", downloadCount: 1 });
  for (const subpath of ["report-119.csv", "report.CSV", "download-status/extra", "upload", "missing"]) assert.equal(route(initial, subpath), undefined, subpath);
});

test("the page renders recorded downloads and uploads, escaping the uploaded name", () => {
  const recorded = mutate(mutate(create(119), "record-download", { filename: "report-119.csv" }), "upload", { name: "<img src=x>.csv", size: 3 });
  const html = render(recorded);
  assert.match(html, /<p data-testid="download-recorded">Downloaded report-119\.csv<\/p>/);
  assert.match(html, /<p data-testid="upload-result">Uploaded &lt;img src=x&gt;\.csv<\/p><p data-testid="upload-size">3 bytes<\/p>/);
  assert.doesNotMatch(html, /<img src=x>/);
});

test("over HTTP, a GET of the report records one download, HEAD records none, and uploads reach the oracle", async () => {
  const lab = await startScenarioLab({ runToken: TOKEN, seed: 119 });
  const authorization = `Bearer ${TOKEN}`;
  const read = async () => ((await (await fetch(`${lab.origin}/__control/final-state?scenario=file-transfer`, { headers: { authorization } })).json()) as { state: FileTransferState }).state;
  try {
    const head = await fetch(`${lab.origin}/scenarios/file-transfer/report.csv`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-disposition"), 'attachment; filename="report-119.csv"');
    assert.equal((await read()).downloadCount, 0);
    const download = await fetch(`${lab.origin}/scenarios/file-transfer/report.csv`);
    assert.equal(download.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.equal(download.headers.get("content-disposition"), 'attachment; filename="report-119.csv"');
    assert.equal(await download.text(), REPORT_119);
    assert.equal((await read()).downloadCount, 1);
    const status = await fetch(`${lab.origin}/scenarios/file-transfer/download-status`);
    assert.deepEqual(await status.json(), { filename: "report-119.csv", downloadCount: 1 });
    assert.equal((await read()).downloadCount, 1);
    assert.equal((await fetch(`${lab.origin}/scenarios/file-transfer/missing`)).status, 404);
    const upload = await fetch(`${lab.origin}/api/file-transfer/upload`, {
      method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify({ name: "expense-receipts.csv", size: 31 }),
    });
    assert.equal(upload.status, 200);
    assert.deepEqual(await read(), { seed: 119, reportFilename: "report-119.csv", downloadCount: 1, uploadCount: 1, lastUpload: { name: "expense-receipts.csv", size: 31 } });
    const page = await (await fetch(`${lab.origin}/scenarios/file-transfer/`)).text();
    assert.match(page, /data-testid="download-recorded">Downloaded report-119\.csv</);
    assert.match(page, /data-testid="upload-result">Uploaded expense-receipts\.csv</);
  } finally {
    await lab.close();
  }
});
