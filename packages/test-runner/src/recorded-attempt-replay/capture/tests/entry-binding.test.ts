import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { recordedRequestDigest } from "../../request-digest.js";
import { bindRecordedCaptureEntry } from "../entry-binding.js";
import { RECORDED_CAPTURE_FILES } from "../files.js";
import { recordedCaptureRequest } from "../request.js";

const declared = recordedCaptureRequest({ projectId: "project.fixture", flowId: "flow.fixture", startLocation: "http://127.0.0.1/company", taskId: "company-website-apprentices" });
const facts = { projectId: "project.fixture", flowId: "flow.fixture", taskId: "company-website-apprentices", oracleDigest: "a".repeat(64), storeDigest: "b".repeat(64), capturedAt: "2026-11-23T00:00:00.000Z" };
const routed = () => ({ projectId: declared.projectId, flowId: declared.flowId, caller: { actorUserId: "user.fixture", actorSessionId: "session.live-credential-fixture" }, permittedConsequences: [], evidenceGuided: true as const, startLocation: declared.startLocation!, taskProcessing: structuredClone(declared.taskProcessing!), permissionAskTimeoutMs: 120_000 });

async function fixtureRoot(wireFile?: string) {
  const work = await mkdtemp(path.join(os.tmpdir(), "recorded-capture-entry-"));
  const root = path.join(work, "fluxiq-root");
  await mkdir(root);
  await writeFile(path.join(root, RECORDED_CAPTURE_FILES.configuration), JSON.stringify({ facts, declared, wireFile: wireFile ?? path.join(root, RECORDED_CAPTURE_FILES.wire) }));
  return { work, root };
}

test("the host binds the stopped store's facts to the entry its service received, and leaves both for the runner", async () => {
  const { work, root } = await fixtureRoot();
  try {
    const bound = await bindRecordedCaptureEntry(root, routed());
    const kept = JSON.parse(await readFile(path.join(root, RECORDED_CAPTURE_FILES.entry), "utf8"));
    assert.deepEqual(kept.entry, JSON.parse(JSON.stringify(bound.entry)));
    assert.equal(kept.receipt.entryDigest, recordedRequestDigest(JSON.stringify(bound.entry)));
    assert.equal(kept.receipt.storeDigest, facts.storeDigest);
    assert.equal(kept.receipt.capturedAt, facts.capturedAt);
    assert.equal(kept.receipt.position, "before_entry");
    assert.deepEqual(JSON.parse(Buffer.from(kept.receiptBase64, "base64").toString("utf8")), kept.receipt);
    assert.equal(bound.wireFile, path.join(root, RECORDED_CAPTURE_FILES.wire));
    assert.throws(() => bound.attach(), /recorded_start_capture_trace_mismatch/u);
    await assert.rejects(() => readFile(path.join(root, RECORDED_CAPTURE_FILES.refusal)), { code: "ENOENT" });
    await assert.rejects(() => bindRecordedCaptureEntry(root, routed()), { code: "EEXIST" });
  } finally { await rm(work, { recursive: true, force: true }); }
});

test("a refused entry leaves its code and binds nothing", async () => {
  const { work, root } = await fixtureRoot();
  try {
    await assert.rejects(() => bindRecordedCaptureEntry(root, { ...routed(), startLocation: "http://127.0.0.1/elsewhere" }), /recorded_capture_actual_entry_changed/u);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, RECORDED_CAPTURE_FILES.refusal), "utf8")), { code: "recorded_capture_actual_entry_changed" });
    await assert.rejects(() => readFile(path.join(root, RECORDED_CAPTURE_FILES.entry)), { code: "ENOENT" });
    const callerless: ReturnType<typeof routed> = JSON.parse(JSON.stringify({ ...routed(), caller: undefined }));
    await assert.rejects(() => bindRecordedCaptureEntry(root, callerless), /recorded_capture_caller_unreadable/u);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, RECORDED_CAPTURE_FILES.refusal), "utf8")), { code: "recorded_capture_actual_entry_changed" });
  } finally { await rm(work, { recursive: true, force: true }); }
});

test("a wire file outside the isolated root's parent is refused before any entry is bound", async () => {
  const elsewhere = await mkdtemp(path.join(os.tmpdir(), "recorded-capture-elsewhere-"));
  const { work, root } = await fixtureRoot(path.join(elsewhere, "wire.json"));
  try {
    await assert.rejects(() => bindRecordedCaptureEntry(root, routed()), /recorded_capture_wire_scope_refused/u);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, RECORDED_CAPTURE_FILES.refusal), "utf8")), { code: "recorded_capture_wire_scope_refused" });
  } finally {
    await rm(work, { recursive: true, force: true });
    await rm(elsewhere, { recursive: true, force: true });
  }
});
