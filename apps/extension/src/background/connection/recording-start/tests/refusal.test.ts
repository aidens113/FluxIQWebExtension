// Coverage of refusal.ts: FluxIQ sends one wire code for two opposite
// failures, and the classifier is the only place that tells them apart.

import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRecordingStartRefusal,
  isRecordingStartRefusalError,
  recordingStartRefusalBlock
} from "../refusal";

// Core's own shape: `apps/web/src/lib/fluxiq.ts` builds this metadata and
// `client-gateway/bridge.ts` merges its own fields in before sending.
function refusalPayload(metadata: Record<string, unknown>) {
  return {
    message: "Recording cannot start because Automation Studio does not have an open project.",
    code: "recording.project_required",
    metadata: { source: "automation-studio", clientId: "client.alpha", clientName: "Chrome", ...metadata }
  };
}

test("a refusal that still names an active project is the freshness check, so it is transient", () => {
  const refusal = classifyRecordingStartRefusal(refusalPayload({ activeProjectId: "project.alpha", contextUpdatedAt: 1_000 }));
  assert.equal(refusal?.kind, "transient");
  assert.equal(refusal?.reason, "context_stale");
  // The operator's own move is what unsticks it, so the message has to say so.
  assert.match(refusal?.message ?? "", /Automation Studio tab/);
});

test("a refusal naming no active project is nobody having chosen one, so it is persistent", () => {
  for (const metadata of [{ activeProjectId: null, contextUpdatedAt: 0 }, { activeProjectId: "   " }, {}]) {
    const refusal = classifyRecordingStartRefusal(refusalPayload(metadata));
    assert.equal(refusal?.kind, "persistent", `metadata ${JSON.stringify(metadata)}`);
    assert.equal(refusal?.reason, "project_not_selected");
  }
});

test("the not-selected refusal keeps the wording the panel and the runner already read", () => {
  const refusal = classifyRecordingStartRefusal(refusalPayload({ activeProjectId: null }));
  assert.equal(refusal?.code, "recording.project_required");
  assert.equal(refusal?.title, "Project Required");
  assert.equal(refusal?.lastError, "Open a FluxIQ project before recording.");
});

test("a project mismatch is persistent: re-sending sends the same wrong project", () => {
  const refusal = classifyRecordingStartRefusal({
    message: "Recording cannot start because the requested project does not match the approving operator's active project.",
    code: "recording.project_context_mismatch",
    metadata: { activeProjectId: "project.alpha", requestedProjectId: "project.beta", contextUpdatedAt: 9 }
  });
  assert.equal(refusal?.kind, "persistent");
  assert.equal(refusal?.reason, "project_mismatch");
});

test("a server error that is not a start refusal is not classified at all", () => {
  assert.equal(classifyRecordingStartRefusal({ message: "Gateway closed", code: "gateway.closed" }), undefined);
  assert.equal(classifyRecordingStartRefusal({ message: "Gateway closed" }), undefined);
  // Metadata that is not an object must not be read as one.
  assert.equal(classifyRecordingStartRefusal({ message: "x", code: "recording.project_required", metadata: "activeProjectId" })?.reason, "project_not_selected");
});

test("an exhausted refusal says it was retried; a first refusal does not", () => {
  const refusal = classifyRecordingStartRefusal(refusalPayload({ activeProjectId: "project.alpha" }))!;
  assert.doesNotMatch(recordingStartRefusalBlock(refusal, 1).message, /Retried/);
  assert.match(recordingStartRefusalBlock(refusal, 2).message, /Retried 1 time\./);
  assert.match(recordingStartRefusalBlock(refusal, 4).message, /Retried 3 times\./);
});

test("dismissing a block clears a refusal's error and leaves an unrelated one alone", () => {
  assert.equal(isRecordingStartRefusalError("Open a FluxIQ project before recording."), true);
  assert.equal(isRecordingStartRefusalError("FluxIQ's project context went stale before recording could start."), true);
  assert.equal(isRecordingStartRefusalError("Connect to FluxIQ before recording."), false);
  assert.equal(isRecordingStartRefusalError(undefined), false);
});
