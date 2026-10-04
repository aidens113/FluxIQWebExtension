import assert from "node:assert/strict";
import test from "node:test";
import { relayConversation } from "../../../../background/panel";
import type { PanelMessage, PanelResult } from "../../../state";
import { createConversationController } from "../controller";
import { sameThread } from "../../same-thread";
import type { ChatTarget } from "../../target";
import { manualClock } from "./manual-clock";

const target = (projectId: string): ChatTarget => ({ kind: "project", projectId });
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function fixture() {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  let denied = false, mismatched = false, mismatchTail = false, missingTail = false;
  let opened = false;
  let release: (() => void) | undefined;
  let holdOld = false;
  const oldTurns = [{ turnId: "old-1", author: "person", text: "old retained task", ask: null }];
  const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
    const result = await relayConversation(message, {
      projectId: () => "old",
      pageLocation: async () => "https://fixture.invalid/",
      async call(endpoint, payload) {
        calls.push({ endpoint, payload });
        if (denied && payload.projectId === "new") return { ok: false, code: "forbidden", error: "Synthetic project denied" };
        const projectId = String(payload.projectId);
        const conversation = { projectId: mismatched ? "old" : projectId, conversationId: `${projectId}-thread`, revision: 1 };
        if (endpoint === "list-conversations") {
          if (holdOld && projectId === "old") await new Promise<void>(resolve => { release = resolve; });
          return { ok: true, payload: { conversations: projectId === "old" || opened || mismatched ? [conversation] : [] } };
        }
        if (endpoint === "get-conversation") return { ok: true, payload: { conversation: missingTail ? null : { conversation: { ...conversation, projectId: mismatchTail ? "old" : conversation.projectId }, turns: projectId === "old" ? oldTurns : [{ turnId: "new-ask", author: "automation", text: "synthetic question", ask: { askId: "ask-new", kind: "confirm", status: "pending", options: null, answer: null } }], hasMore: false } } };
        if (endpoint === "open-conversation") { opened = true; return { ok: true, payload: { conversation } }; }
        return { ok: true, payload: {} };
      }
    });
    assert.ok(result);
    return result.ok ? { ok: true, value: result as T } : { ok: false, sentence: result.error, code: result.code };
  };
  const controller = createConversationController(request, () => undefined, manualClock().clock);
  return { controller, calls, oldTurns, missingTail: () => { missingTail = true; opened = true; }, existingNew: () => { opened = true; }, deny: () => { denied = true; }, mismatch: () => { mismatched = true; }, mismatchTail: () => { mismatchTail = true; opened = true; }, holdOld: () => { holdOld = true; }, release: () => release?.() };
}

test("different project targets are different threads while legacy latest remains the same", () => {
  assert.equal(sameThread(target("old"), target("new")), false);
  assert.equal(sameThread(target("new"), target("new")), true);
  assert.equal(sameThread(target("new"), { kind: "latest" }), false);
  assert.equal(sameThread({ kind: "latest" }, { kind: "latest" }), true);
});

test("authorized empty new-project read clears old thread and first Send opens only new scope", async () => {
  const f = fixture();
  f.controller.setConnected(true); await f.controller.refresh();
  assert.equal(f.controller.state().conversationId, "old-thread");
  f.controller.setTarget(target("new")); await f.controller.refresh();
  assert.equal(f.controller.state().scopeState, "ready");
  assert.equal(f.controller.state().projectId, "new");
  assert.equal(f.controller.state().conversationId, undefined);
  assert.deepEqual(f.controller.state().turns, []);
  assert.equal(await f.controller.send("new independent task"), true);
  const write = f.calls.filter(c => c.endpoint === "open-conversation" || c.endpoint === "append-turn");
  assert.deepEqual(write.map(c => c.payload.projectId), ["new", "new"]);
  assert.equal(write[1]!.payload.conversationId, "new-thread");
  assert.ok(Array.isArray(write[1]!.payload.capabilities));
  assert.deepEqual(f.oldTurns, [{ turnId: "old-1", author: "person", text: "old retained task", ask: null }]);
});

test("late old-project list cannot publish new-project readiness or restore old thread", async () => {
  const f = fixture(); f.holdOld();
  f.controller.setConnected(true); await settle();
  f.controller.setTarget(target("new"));
  assert.equal(f.controller.state().scopeState, "loading");
  assert.equal(await f.controller.send("must wait"), false);
  f.release(); await f.controller.refresh();
  assert.equal(f.controller.state().scopeState, "ready");
  assert.equal(f.controller.state().projectId, "new");
  assert.equal(f.controller.state().conversationId, undefined);
});

test("denied or mismatched scoped list blocks Send instead of using old conversation", async () => {
  for (const change of ["deny", "mismatch"] as const) {
    const f = fixture(); f.controller.setTarget(target("new")); f[change]();
    f.controller.setConnected(true); await f.controller.refresh();
    assert.equal(f.controller.state().scopeState, "error");
    assert.equal(await f.controller.send("must not send"), false);
    assert.equal(f.calls.some(c => c.endpoint === "append-turn" || c.endpoint === "open-conversation"), false);
  }
});

test("mismatched get-conversation project cannot become ready after a valid list", async () => {
  const f = fixture(); f.mismatchTail(); f.controller.setTarget(target("new"));
  f.controller.setConnected(true); await f.controller.refresh();
  assert.equal(f.controller.state().scopeState, "error");
  assert.equal(await f.controller.send("must not send"), false);
});

test("scoped existing thread read and permission answer retain actual selected project", async () => {
  const f = fixture(); f.existingNew(); f.controller.setTarget(target("new"));
  f.controller.setConnected(true); await f.controller.refresh();
  assert.equal(f.controller.state().scopeState, "ready");
  assert.equal(f.controller.state().conversationId, "new-thread");
  await f.controller.answer("ask-new", "grant");
  assert.equal(f.calls.find(c => c.endpoint === "answer-ask")?.payload.projectId, "new");
  assert.ok(f.calls.every(c => c.payload.projectId === "new"));
});

test("listed thread vanishing during get is not an authorized empty-list readiness", async () => {
  const f = fixture(); f.missingTail(); f.controller.setTarget(target("new"));
  f.controller.setConnected(true); await f.controller.refresh();
  assert.equal(f.controller.state().scopeState, "error");
  assert.equal(await f.controller.send("must not send"), false);
});
