// "Open in FluxIQ panel": one wording for every control, and the chat's open carries the conversation and
// project on screen, but only where it opens the panel's own page for nothing else (no Flow, no purpose page).

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelStore } from "../../state";
import { createOpenFluxIQButton, OPEN_IN_PANEL, type OpenFluxIQConversation, type OpenFluxIQPurpose } from "../index";

async function sentBy(purpose: OpenFluxIQPurpose | undefined, flowId: string | undefined, conversation: () => OpenFluxIQConversation | undefined): Promise<Record<string, unknown>[]> {
  const sent: Record<string, unknown>[] = [];
  const request = (async (message: Record<string, unknown>) => {
    sent.push(message);
    return { ok: true, value: {} };
  }) as unknown as PanelStore["request"];
  await withFakeDocument(async () => {
    const view = createOpenFluxIQButton(request, { label: OPEN_IN_PANEL, look: "small", ...(purpose === undefined ? {} : { purpose }) }, () => flowId, conversation);
    fake(view.element).children[0]!.dispatch("click");
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  return sent;
}

const THREAD = () => ({ conversationId: "c1", projectId: "p1" });

test("the one wording is Open in FluxIQ panel", () => {
  assert.equal(OPEN_IN_PANEL, "Open in FluxIQ panel");
});

test("with a thread on screen and nothing else to open, the panel opens on that conversation and project", async () => {
  assert.deepEqual(await sentBy(undefined, undefined, THREAD), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ, conversationId: "c1", projectId: "p1" }]);
  assert.deepEqual(await sentBy("ask", undefined, THREAD), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ, conversationId: "c1", projectId: "p1" }]);
});

test("a Flow, or a page of its own (keys, projects, pairing), opens that and carries no conversation", async () => {
  assert.deepEqual(await sentBy(undefined, "f1", THREAD), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ, flowId: "f1" }]);
  for (const purpose of ["model-key", "projects", "pairing"] as const) assert.deepEqual(await sentBy(purpose, undefined, THREAD), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ, purpose }]);
});

test("with no thread, or half of one, the plain open is sent", async () => {
  assert.deepEqual(await sentBy(undefined, undefined, () => undefined), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ }]);
  assert.deepEqual(await sentBy(undefined, undefined, () => ({ conversationId: "c1" })), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ }]);
});
