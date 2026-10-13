import assert from "node:assert/strict";
import test from "node:test";
import { fake, withFakeDocument } from "../../../chat/tests/fake-dom";
import { statusWith } from "../../../tests/status-fixture";
import { createRecordingReview } from "../recording-review";

test("a finished recording offers explicit task authoring and never generates, tests or approves", async () => {
  await withFakeDocument(async () => {
    const calls: Record<string, unknown>[] = [];
    const request = async (message: Record<string, unknown>) => { calls.push(message); return { ok: true, value: {} }; };
    const review = createRecordingReview({ store: { request } } as unknown as Parameters<typeof createRecordingReview>[0]);
    const root = fake(review.element);
    const status = (recordingState: "recording" | "idle") => review.render(statusWith({ recordingState, paired: true, connectionState: "connected" }));
    status("idle");
    assert.equal(root.hidden, true);
    status("recording");
    status("idle");
    assert.equal(root.hidden, false);
    const buttons = root.descendants().filter((node) => node.tagName === "BUTTON");
    assert.deepEqual(buttons.map((node) => node.textContent), ["Author task instructions in FluxIQ", "Done"]);
    buttons[0]!.dispatch("click");
    await Promise.resolve();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.type, "fluxiq.panel.openFluxIQ");
    buttons[1]!.dispatch("click");
    assert.equal(root.hidden, true);
  });
});
