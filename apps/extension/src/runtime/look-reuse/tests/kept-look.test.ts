// One capture a step (task speed S4): the worker answers a look with the one it
// kept while every frame's mark and the tab's navigation epoch stand, and takes
// a fresh look the moment anything moved -- a mutation between steps, a frame's
// script replaced, a navigation, or any act sent to the tab.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrowserActionCommand, BrowserActionResult } from "../../../shared/protocol";
import { keptLooks, type LookReuseAccess } from "..";

type Page = { frames: number[]; marks: Map<number, { instance: string; changes: number } | undefined>; epoch: number; captures: number; asked: number };

function page(frames: number[] = [0]): Page {
  return { frames, marks: new Map(frames.map((frameId) => [frameId, { instance: `frame-${frameId}`, changes: 0 }])), epoch: 0, captures: 0, asked: 0 };
}

function access(state: Page): LookReuseAccess {
  return {
    frames: async () => state.frames.map((frameId) => ({ frameId })),
    send: async (_tabId, message, frameId) => {
      assert.deepEqual(message, { type: "fluxiq.pageChanges" });
      state.asked += 1;
      const mark = state.marks.get(frameId);
      if (mark === undefined) throw new Error("Could not establish connection. Receiving end does not exist.");
      return { ...mark };
    },
    epoch: () => state.epoch
  };
}

function look(commandId: string, extra: Partial<BrowserActionCommand> = {}): BrowserActionCommand {
  return { commandId, actionType: "web.dom.capture_snapshot", ...extra } as BrowserActionCommand;
}

function capture(state: Page, during?: () => void): () => Promise<BrowserActionResult> {
  return async () => {
    state.captures += 1;
    during?.();
    return { commandId: "taken", actionType: "web.dom.capture_snapshot", status: "succeeded", validation: { status: "passed" }, snapshot: { capture: state.captures }, startedAt: 1, finishedAt: 2 } as unknown as BrowserActionResult;
  };
}

function bump(state: Page, frameId = 0): void {
  const mark = state.marks.get(frameId)!;
  state.marks.set(frameId, { ...mark, changes: mark.changes + 1 });
}

test("a look the page has not moved since is answered with the kept one, stamped as this command's", async () => {
  keptLooks.forget(undefined);
  const state = page([0, 3]);
  const first = await keptLooks.look(1, look("a"), false, access(state), capture(state));
  const second = await keptLooks.look(1, look("b"), false, access(state), capture(state));
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(state.captures, 1, "one capture for two looks");
  assert.equal(second.result.commandId, "b");
  assert.deepEqual(second.result.snapshot, { capture: 1 });
  assert.ok(second.result.startedAt >= first.result.finishedAt, "timed as the check, not as the old capture");
});

test("a mutation between steps, in any frame, takes a fresh look", async () => {
  keptLooks.forget(undefined);
  const state = page([0, 3]);
  await keptLooks.look(1, look("a"), false, access(state), capture(state));
  bump(state, 3);
  const after = await keptLooks.look(1, look("b"), false, access(state), capture(state));
  assert.equal(after.reused, false);
  assert.deepEqual(after.result.snapshot, { capture: 2 });
  // And the fresh look is kept in its turn.
  assert.equal((await keptLooks.look(1, look("c"), false, access(state), capture(state))).reused, true);
});

test("a navigation event, a replaced script or a frame that cannot answer takes a fresh look", async () => {
  for (const move of [
    (state: Page) => { state.epoch += 1; },
    (state: Page) => { state.marks.set(0, { instance: "frame-0-new-document", changes: 0 }); },
    (state: Page) => { state.marks.set(0, undefined); },
    (state: Page) => {
      state.frames = [0, 3, 5];
      state.marks.set(5, { instance: "frame-5", changes: 0 });
    }
  ]) {
    keptLooks.forget(undefined);
    const state = page([0, 3]);
    await keptLooks.look(1, look("a"), false, access(state), capture(state));
    move(state);
    assert.equal((await keptLooks.look(1, look("b"), false, access(state), capture(state))).reused, false);
    assert.equal(state.captures, 2);
  }
});

test("any act sent to the tab forgets its look, a read does not, and another tab's look stands", async () => {
  keptLooks.forget(undefined);
  const state = page();
  await keptLooks.look(1, look("a"), false, access(state), capture(state));
  await keptLooks.look(2, look("a2"), false, access(state), capture(state));
  keptLooks.forget(1, { commandId: "r", actionType: "web.dom.extract_list" } as BrowserActionCommand);
  assert.equal((await keptLooks.look(1, look("b"), false, access(state), capture(state))).reused, true);
  keptLooks.forget(1, { commandId: "c", actionType: "web.dom.click" } as BrowserActionCommand);
  assert.equal((await keptLooks.look(1, look("c"), false, access(state), capture(state))).reused, false, "the look after an act is always taken fresh");
  assert.equal((await keptLooks.look(2, look("d"), false, access(state), capture(state))).reused, true);
});

test("a look the page moved under while it was taken is not kept", async () => {
  keptLooks.forget(undefined);
  const state = page();
  await keptLooks.look(1, look("a"), false, access(state), capture(state, () => bump(state)));
  assert.equal((await keptLooks.look(1, look("b"), false, access(state), capture(state))).reused, false);
  keptLooks.forget(undefined);
  await keptLooks.look(1, look("c"), false, access(state), capture(state, () => { state.epoch += 1; }));
  assert.equal((await keptLooks.look(1, look("d"), false, access(state), capture(state))).reused, false);
});

test("only a plain whole-tab look is kept: a frame's look, a structure look and a failed look are always taken fresh", async () => {
  keptLooks.forget(undefined);
  const state = page();
  await keptLooks.look(1, look("a"), true, access(state), capture(state));
  assert.equal((await keptLooks.look(1, look("b"), true, access(state), capture(state))).reused, false);
  const structure = look("s", { detectStructure: {} } as Partial<BrowserActionCommand>);
  await keptLooks.look(1, structure, false, access(state), capture(state));
  assert.equal((await keptLooks.look(1, structure, false, access(state), capture(state))).reused, false);
  assert.equal(state.asked, 0, "a look never kept asks no frame");
  // A look with hidden elements is not the plain one, and the other way round.
  await keptLooks.look(1, look("p"), false, access(state), capture(state));
  assert.equal((await keptLooks.look(1, look("h", { options: { includeHidden: true } } as Partial<BrowserActionCommand>), false, access(state), capture(state))).reused, false);
  const failed = async () => ({ commandId: "x", actionType: "web.dom.capture_snapshot", status: "failed", validation: { status: "failed" }, startedAt: 1, finishedAt: 2 }) as unknown as BrowserActionResult;
  keptLooks.forget(undefined);
  await keptLooks.look(1, look("f"), false, access(state), failed);
  assert.equal((await keptLooks.look(1, look("g"), false, access(state), capture(state))).reused, false);
});
