import assert from "node:assert/strict";
import test from "node:test";
import { onConfirmationPage } from "./confirmation-fixture";
import { EXTRACTION_PICK_CANCELLED_MESSAGE } from "../../../shared/extraction-messages";

test("known old cancel cannot release a replacement picker", async () => {
  await onConfirmationPage(page => {
    page.command("pickStart", "A");
    page.command("pickStart", "B");
    assert.deepEqual(page.command("pickCancel", "A"), { ok: true });
    assert.equal(page.listeners.get("pointerdown")?.length, 1);
    page.command("pickCancel", "B");
    assert.equal(page.listeners.get("pointerdown")?.length, 0);
  });
});

test("known retired start and unknown cancelled start cannot replace the current picker", async () => {
  await onConfirmationPage(page => {
    page.command("pickStart", "A");
    page.command("pickStart", "B");
    const current = page.listeners.get("pointerdown")![0];
    assert.deepEqual(page.command("pickStart", "A"), { ok: false, refused: "stale_session" });
    page.command("pickCancel", "unseen");
    assert.deepEqual(page.command("pickStart", "unseen"), { ok: false, refused: "stale_session" });
    assert.equal(page.listeners.get("pointerdown")![0], current);
    assert.deepEqual(page.command("pickStart", "new-opaque-id"), { ok: true });
    assert.notEqual(page.listeners.get("pointerdown")![0], current);
  });
});

test("duplicate picking start keeps one listener and refused pick rearms the same ID", async () => {
  await onConfirmationPage(page => {
    page.command("pickStart", "A");
    const current = page.listeners.get("pointerdown")![0];
    page.command("pickStart", "A");
    assert.deepEqual(page.listeners.get("pointerdown"), [current]);
    page.fire("pointerdown", null);
    assert.deepEqual(page.command("record", "A", {}), { ok: false, refused: "stale_session" });
    page.fire("click");
    const definition = page.pick("A");
    page.fire("click");
    assert.deepEqual(page.command("record", "A", definition), { ok: true });
  });
});

for (const state of ["picking", "picked"] as const) {
  test(`retired and mismatching record do not release or emit against B ${state}`, async () => {
    await onConfirmationPage(page => {
      const definition = page.pick("A");
      if (state === "picking") page.command("pickStart", "B");
      else page.pick("B");
      const current = page.listeners.get("pointerdown")![0];
      for (const id of ["A", "unowned"]) assert.deepEqual(page.command("record", id, definition), { ok: false, refused: "stale_session" });
      assert.equal(page.listeners.get("pointerdown")![0], current);
      assert.equal(page.sent.filter(message => message.payload?.kind === "data.extract").length, 0);
    });
  });
}

test("retained callbacks and old timers cannot swallow or release replacement lease", async () => {
  await onConfirmationPage(page => {
    page.pick("A");
    const oldCallbacks = [...page.listeners.get("pointerdown")!, ...page.listeners.get("pointermove")!, ...page.listeners.get("keydown")!];
    const oldTimer = [...page.timers.values()].at(-1)!;
    page.command("pickStart", "B");
    let swallowed = false;
    for (const callback of oldCallbacks) callback({ type: "pointerdown", key: "Escape", preventDefault: () => { swallowed = true; }, stopImmediatePropagation: () => { swallowed = true; } } as unknown as Event);
    oldTimer();
    assert.equal(swallowed, false);
    assert.equal(page.listeners.get("pointerdown")?.length, 1);
    const definition = page.pick("B");
    page.fire("click");
    assert.deepEqual(page.command("record", "B", definition), { ok: true });
  });
});

test("same-lease restarted timer has an exact operation token", async () => {
  await onConfirmationPage(page => {
    const definition = page.pick("A");
    const old = [...page.timers.values()].at(-1)!;
    assert.equal(page.fire("mousedown").swallowed, true);
    const current = [...page.timers.values()].at(-1)!;
    old();
    assert.equal(page.listeners.get("pointerdown")?.length, 1);
    for (const type of ["pointerup", "mouseup", "contextmenu"]) assert.equal(page.fire(type).swallowed, true);
    current();
    assert.equal(page.listeners.get("pointerdown")?.length, 1, "later events restarted the drain token again");
    [...page.timers.values()].at(-1)!();
    assert.equal(page.listeners.get("pointerdown")?.length, 0);
    assert.deepEqual(page.command("record", "A", definition), { ok: true });
  });
});

test("picking Escape retires once; matching cancellation after a picked drain retires confirmation", async () => {
  await onConfirmationPage(page => {
    page.command("pickStart", "A");
    page.fire("keydown", undefined, "Escape");
    page.fire("keydown", undefined, "Escape");
    assert.deepEqual(page.sent.filter(message => message.type === EXTRACTION_PICK_CANCELLED_MESSAGE).map(message => message.sessionId), ["A"]);
    assert.deepEqual(page.command("pickStart", "A"), { ok: false, refused: "stale_session" });
    const definition = page.pick("B");
    page.fire("click");
    page.command("pickCancel", "B");
    assert.deepEqual(page.command("record", "B", definition), { ok: false, refused: "stale_session" });
    assert.equal(page.sent.filter(message => message.type === EXTRACTION_PICK_CANCELLED_MESSAGE).length, 1);
  });
});

test("rearming a refused lease and administrative reset invalidate retained callback instances", async () => {
  await onConfirmationPage(page => {
    page.command("pickStart", "A");
    const old = page.listeners.get("pointerdown")![0]!;
    page.fire("pointerdown", null);
    page.command("pickStart", "A");
    let swallowed = false;
    const staleEvent = { type: "pointerdown", preventDefault: () => { swallowed = true; }, stopImmediatePropagation: () => { swallowed = true; } } as unknown as Event;
    old(staleEvent);
    assert.equal(swallowed, false);
    const beforeReset = page.listeners.get("pointerdown")![0]!;
    page.command("pickCancel", "A");
    assert.deepEqual(page.command("pickStart", "A"), { ok: false, refused: "stale_session" });
    page.reset();
    assert.deepEqual(page.command("pickStart", "A"), { ok: true });
    beforeReset(staleEvent);
    assert.equal(swallowed, false);
    assert.equal(page.listeners.get("pointerdown")?.length, 1);
  });
});
