import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime } from "../../..";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";

test("repair intent comes only from the exact runtime-retained packet binding, never a reused or altered packet", async () => {
  let consent = true;
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.intent"],
    executeAction: async (_session, command) => command.actionType === "web.dom.capture_snapshot" ? {
      status: "succeeded", payload: { snapshot: {
        url: "https://example.test/notice", title: consent ? "Consent response" : "Offer",
        interactiveElements: [
          { tagName: "div", role: "dialog", selector: "#notice" },
          { tagName: "button", selector: "#answer", accessibleName: consent ? "Accept all" : "Buy now", parent: 0 }
        ], evidence: { dialogs: { open: [{ selector: "#notice", modal: false, kind: consent ? "consent" : "promotion" }] } }
      } }
    } : { status: "succeeded" }
  });
  const scope = { projectId: "project.repair-intent", flowId: "flow.repair-intent", runId: "run.repair-intent" };
  const capture = async () => JSON.parse(JSON.stringify(await runtime.captureSanitizedFailureEvidence({
    ...scope, failedAction: { attemptId: "attempt.intent", nodeId: "node.intent", definitionId: "web.output.dom-click", status: "failed" }
  }))) as JsonObject;
  const before = await capture();
  const handle = shownHandle(before, "Accept all");
  consent = false;
  const later = await capture();
  const resolve = (packet: JsonObject, target = handle) => runtime.resolvePlanNodeParameters({
    ...scope, nodeDefinitionId: "web.output.dom-click", parameters: { target: { handle: target }, controlIntent: { intent: "accept", responseOnly: true } },
    declaredConsequences: [], permission: async () => ({ permitted: true as const }), handleEvidence: packet
  });
  const original = await resolve(before);
  assert.equal(original.status, "resolved", JSON.stringify(original));
  if (original.status === "resolved") assert.deepEqual(original.controlIntent, { intent: "accept", responseOnly: true });
  const offer = await resolve(later, shownHandle(later, "Buy now"));
  assert.equal(offer.status, "resolved", JSON.stringify(offer));
  if (offer.status === "resolved") assert.deepEqual(offer.controlIntent, { intent: "accept" });
  for (const packet of [
    { ...before, page: `${String(before.page)}\n(edited)` },
    { ...before, page: String(before.page).replace("Accept all", "Buy now") },
    { schemaVersion: "web-llm-page.v3", page: "PAGE unretained\nURL https://example.test/\nt2 button Accept all" }
  ]) assert.deepEqual(await resolve(packet), { status: "refused", issueCodes: ["web.handle.unknown"] });
});
