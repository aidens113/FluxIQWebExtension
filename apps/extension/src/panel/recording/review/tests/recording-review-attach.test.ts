import assert from "node:assert/strict";
import test from "node:test";
import { fake, withFakeDocument } from "../../../chat/tests/fake-dom";
import { statusWith } from "../../../tests/status-fixture";
import { ATTACH_NEXT_LABEL, createRecordingReview } from "../recording-review";

const context = { store: { request: async () => ({ ok: true, value: {} }) } } as unknown as Parameters<typeof createRecordingReview>[0];

test("the review after a stop offers Attach to my next message and says what happened", async () => {
  await withFakeDocument(async () => {
    let found = true;
    let asked = 0;
    const review = createRecordingReview(context, {
      onAttach: async () => {
        asked += 1;
        return found;
      }
    });
    const root = fake(review.element);
    const status = (recordingState: "recording" | "idle") => review.render(statusWith({ recordingState, paired: true, connectionState: "connected" }));
    status("recording");
    status("idle");
    const attach = root.descendants().find((node) => node.textContent === ATTACH_NEXT_LABEL)!;
    assert.equal(attach.tagName, "BUTTON");
    attach.dispatch("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(asked, 1);
    assert.equal(root.textContent.includes("Attached."), true);
    found = false;
    attach.dispatch("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(root.textContent.includes("Couldn't find this recording"), true);
  });
});
