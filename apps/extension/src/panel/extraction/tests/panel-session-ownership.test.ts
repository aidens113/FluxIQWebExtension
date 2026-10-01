import assert from "node:assert/strict";
import test from "node:test";
import { mountExtractionPanel } from "../panel";
import { EXTRACTION_RUNTIME_MESSAGES as M } from "../../../shared/extraction-messages";
import { withDialogDom } from "./dialog-dom";
import { proposalFixture } from "./proposal-fixture";
import { handleExtractionControl } from "../../../background/extraction";
import { harness, startAndPick, sidepanel, responseOf, AUTOMATION_TAB } from "../../../background/tests/extraction-harness";
const picked = { sessionId: "synthetic-A", tabId: 11, form: "list", state: "picked", proposal: proposalFixture(), preview: [] };
for (const action of ["confirm", "cancel"] as const) test("mounted " + action + " remains bound to selected A after replacement appears", async () => withDialogDom(async world => {
  let current = picked; world.reply = message => message.type === M.getSession ? { ok: true, session: current } : { ok: true };
  mountExtractionPanel(world.native(world.host)); await world.flush(); current = { ...picked, sessionId: "synthetic-B" };
  world.get(action === "confirm" ? "extractionConfirmButton" : "extractionCancelButton").dispatch("click"); await world.flush();
  assert.equal(world.sent.find(message => message.type === M[action])?.sessionId, picked.sessionId);
}));
test("legacy session without real identity cannot publish executable draft", async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true, session: { state: "picked", proposal: proposalFixture(), preview: [] } });
  mountExtractionPanel(world.native(world.host)); await world.flush(); assert.equal(world.get("extractionConfirmButton").disabled, true); assert.equal(world.get("extractionFields").children.length, 0);
}));

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }

test("failed cancel immediately erases raw draft and rows and retries the same selected ID", async () => withDialogDom(async world => {
  let attempts = 0; const pending = deferred<unknown>(); world.reply = message => message.type === M.getSession ? { ok: true, session: { ...picked, preview: [{ name: "synthetic-cell" }] } } : ++attempts === 1 ? pending.promise : { ok: true };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  world.get("extractionFields").querySelector("input")!.value = "unsaved raw"; world.get("extractionFields").querySelector("input")!.dispatch("input");
  world.get("extractionCancelButton").dispatch("click"); await world.flush();
  assert.equal(world.get("extractionFields").children.length, 0); assert.equal(world.get("extractionPreviewBody").textContent, "");
  pending.resolve({ ok: false, error: "Synthetic cancellation refusal" }); await world.flush();
  world.get("extractionCancelButton").dispatch("click"); await world.flush();
  assert.deepEqual(world.sent.filter(message => message.type === M.cancel).map(message => message.sessionId), [picked.sessionId, picked.sessionId]);
  assert.equal(world.get("extractionPanel").hidden, true);
}));
test("pre-start Close is local and sends no cancellation to an unrelated backend session", async () => withDialogDom(async world => {
  world.reply = message => message.type === M.start ? Promise.reject(new Error("Synthetic start failed")) : { ok: true };
  mountExtractionPanel(world.native(world.host)).setAvailable(true); await world.flush(); world.get("extractDataButton").dispatch("click"); await world.flush();
  world.get("extractionCloseButton").dispatch("click"); await world.flush(); assert.equal(world.sent.filter(message => message.type === M.cancel).length, 0);
}));
test("missing bound preview retires local draft without replacement discovery", async () => withDialogDom(async world => {
  world.reply = message => ({ ok: true, ...(message.fields ? {} : { session: picked }) }); mountExtractionPanel(world.native(world.host)); await world.flush();
  const radio = world.get("extractionFields").querySelectorAll("input").find(input => input.type === "radio" && input.value === "exclude")!; radio.checked = true; radio.dispatch("change"); await world.flush();
  assert.equal(world.get("extractionFields").children.length, 0); assert.equal(world.get("extractionPanel").hidden, true);
  assert.equal(world.sent.filter(message => message.type === M.getSession && message.sessionId === undefined).length, 1);
}));

for (const replaced of [false, true]) for (const action of ["confirm", "cancel"] as const) test("actual mounted client/background " + action + (replaced ? " refuses removed A without touching same-tab B" : " targets surviving A while global latest belongs to another tab"), async () => {
  const h = harness(), selected = await startAndPick(h);
  await withDialogDom(async world => {
    Object.assign(chrome.runtime, { id: "extension-id", getURL: (path: string) => "chrome-extension://extension-id/" + path });
    world.reply = async message => responseOf(await handleExtractionControl(message, sidepanel, h.manager, h.deps));
    mountExtractionPanel(world.native(world.host)); await new Promise<void>(resolve => setImmediate(resolve)); await world.flush(); assert.equal(world.get("extractionConfirmButton").disabled, false);
    const manager = replaced ? h.manager : { ...h.manager, status: () => ({ ...h.manager.status(), activeTabId: AUTOMATION_TAB + 1 }) } as typeof h.manager;
    const replacement = responseOf(await handleExtractionControl({ type: M.start }, sidepanel, manager, h.deps)).sessionId as string;
    world.get(action === "confirm" ? "extractionConfirmButton" : "extractionCancelButton").dispatch("click"); await new Promise<void>(resolve => setImmediate(resolve)); await world.flush();
    assert.equal(world.sent.find(message => message.type === M[action])?.sessionId, selected);
    assert.equal(h.deps.sessions.get(replacement)?.state, "picking");
    assert.equal(h.ran.length, !replaced && action === "confirm" ? 1 : 0);
    if (replaced && action === "confirm") assert.match(world.get("extractionNotice").textContent, /no extraction/u);
  });
});

test("recorded receipt Close remains local after successful bound confirmation", async () => withDialogDom(async world => {
  world.reply = message => message.type === M.getSession ? { ok: true, session: picked } : { ok: true };
  mountExtractionPanel(world.native(world.host)); await world.flush(); world.get("extractionConfirmButton").dispatch("click"); await world.flush();
  world.get("extractionCloseButton").dispatch("click"); await world.flush(); assert.equal(world.sent.filter(message => message.type === M.cancel).length, 0);
}));

test("first identity discovered after legacy bare start keeps picking polling alive", async () => withDialogDom(async world => {
  let reads = 0; world.reply = message => message.type === M.getSession ? ++reads === 1 ? { ok: true } : { ok: true, session: reads === 2 ? { ...picked, state: "picking", proposal: undefined } : picked } : { ok: true };
  mountExtractionPanel(world.native(world.host)).setAvailable(true); await world.flush(); world.get("extractDataButton").dispatch("click"); await world.flush();
  await world.tick(); assert.equal(world.get("extractionConfirmButton").disabled, true); await world.tick(); assert.equal(world.get("extractionConfirmButton").disabled, false);
  assert.equal(world.sent.filter(message => message.type === M.start).length, 1); assert.equal(world.sent.filter(message => message.type === M.getSession).at(-1)?.sessionId, picked.sessionId);
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
}));
