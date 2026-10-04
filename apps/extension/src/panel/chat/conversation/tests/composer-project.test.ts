import assert from "node:assert/strict";
import test from "node:test";
import { createComposer } from "../composer";
import type { ConversationState } from "../controller";
import { fake, withFakeDocument } from "../../tests/fake-dom";

test("project loading/error disables composer while ready empty and legacy loading remain usable", async () => {
  await withFakeDocument(async () => {
    const composer = createComposer(async () => true);
    const state: ConversationState = { mode: "empty", turns: [], reading: false, sending: false, answering: new Set(), answerErrors: new Map() };
    const box = fake(composer.element).descendants().find(node => node.id === "conversationInput")!;
    for (const scopeState of ["loading", "error"] as const) { composer.render({ ...state, scopeState, projectId: "new" }); assert.equal(box.disabled, true); }
    composer.render({ ...state, scopeState: "ready", projectId: "new" }); assert.equal(box.disabled, false);
    composer.render({ ...state, mode: "loading" }); assert.equal(box.disabled, false);
  });
});
