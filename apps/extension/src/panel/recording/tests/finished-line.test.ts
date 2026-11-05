import assert from "node:assert/strict";
import test from "node:test";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { createRecordingFinish, NOT_ATTACHED_LINE, SAVING_LINE } from "../finished-line";
import type { PanelStore } from "../../state";
import type { PendingRecordingStore } from "../pending-recording-store";

const pending = { description: "Add a coffee", known: [], at: 1 };

function host(found: boolean) {
  const events: string[] = [];
  const store: PendingRecordingStore = { read: async () => pending, write: async () => undefined, clear: async () => { events.push("cleared"); } };
  const finish = createRecordingFinish({
    request: (async () => ({ ok: true, value: {} })) as PanelStore["request"],
    pending: store,
    attach: async () => true,
    attached: () => events.push("attached"),
    changed: () => events.push("changed"),
    deps: { list: async () => (found ? [{ id: "r", description: "Add a coffee", status: "completed" }] : []), wait: async () => undefined }
  });
  return { finish, events };
}

test("while it saves the bar says so; once attached the line goes and the caret is asked for", async () => {
  await withFakeDocument(async () => {
    const { finish, events } = host(true);
    const run = finish.run(pending);
    assert.equal(finish.shown(), true);
    assert.equal(fake(finish.element).textContent.includes(SAVING_LINE), true);
    await run;
    assert.equal(finish.shown(), false);
    assert.deepEqual(events.filter((event) => event !== "changed"), ["cleared", "attached"]);
  });
});

test("a recording that never shows up leaves a line with OK, until OK is pressed", async () => {
  await withFakeDocument(async () => {
    const { finish, events } = host(false);
    await finish.run(pending);
    assert.equal(finish.shown(), true);
    assert.equal(fake(finish.element).textContent.includes(NOT_ATTACHED_LINE), true);
    assert.equal(events.includes("attached"), false);
    const ok = fake(finish.element).descendants().find((node) => node.tagName === "BUTTON")!;
    assert.equal(ok.textContent, "OK");
    ok.dispatch("click");
    assert.equal(finish.shown(), false);
  });
});
