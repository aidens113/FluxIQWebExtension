import assert from "node:assert/strict";
import test from "node:test";
import { createComposer } from "../composer";
import { draftStorage } from "../draft-storage";
import type { ChatOwner } from "../../owner-context";
import type { ConversationState } from "../controller";
import { fake, withFakeDocument } from "../../tests/fake-dom";
const ready: ConversationState = { mode: "thread", turns: [], reading: false, sending: false, answering: new Set(), answerErrors: new Map() };
function owner(identity: string): ChatOwner { return { identity, token: {}, current: () => true, request: async <T>() => ({ ok: true, value: {} as T }) }; }
async function isolated(body: () => Promise<void>) {
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage"); const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
  try { await withFakeDocument(body); } finally { if (before) Object.defineProperty(globalThis, "localStorage", before); else Reflect.deleteProperty(globalThis, "localStorage"); }
}
test("different owner parks draft; edits and fill never adopt; explicit adoption enables current send", async () => isolated(async () => {
  const calls: string[] = []; const composer = createComposer(async (text) => { calls.push(text); return true; }); composer.setOwner(owner("a")); composer.render(ready); composer.fill("original draft");
  const root = fake(composer.element), box = root.descendants().find((node) => node.id === "conversationInput")!, send = root.descendants().find((node) => node.id === "conversationSendButton")!;
  composer.setOwner(owner("b")); assert.equal(box.value, "original draft"); assert.equal(send.disabled, true);
  box.value = "edited parked draft"; box.dispatch("input"); composer.fill("filled parked draft"); send.dispatch("click"); assert.deepEqual(calls, []); assert.equal(send.disabled, true);
  root.descendants().find((node) => node.textContent === "Use draft here")!.dispatch("click"); assert.equal(send.disabled, false); send.dispatch("click"); await Promise.resolve(); assert.deepEqual(calls, ["filled parked draft"]); assert.equal(box.value, "");
}));
test("accepted old-owner send cannot clear adopted identical text or release a new pending send", async () => isolated(async () => {
  const finishes: Array<(sent: boolean) => void> = []; const composer = createComposer(() => new Promise((resolve) => finishes.push(resolve))); const a = owner("a"); composer.setOwner(a); composer.render(ready); composer.fill("same text");
  const root = fake(composer.element), box = root.descendants().find((node) => node.id === "conversationInput")!, send = root.descendants().find((node) => node.id === "conversationSendButton")!;
  send.dispatch("click"); composer.setOwner(owner("b")); composer.render(ready); root.descendants().find((node) => node.textContent === "Use draft here")!.dispatch("click"); send.dispatch("click");
  finishes[0]!(true); await Promise.resolve(); assert.equal(box.value, "same text"); assert.equal(send.disabled, true); assert.equal(draftStorage().readOwned().owner, "b");
  finishes[1]!(true); await Promise.resolve(); assert.equal(box.value, ""); assert.equal(send.disabled, true);
}));
test("current matching owner restores without repeated review; legacy and foreign drafts require adoption", async () => isolated(async () => {
  draftStorage().writeOwned("restored text", "a"); const first = createComposer(async () => true); first.setOwner(owner("a")); first.render(ready); assert.equal(fake(first.element).byClass("composer-draft-review")[0]!.hidden, true);
  const second = createComposer(async () => true); second.setOwner(owner("b")); second.render(ready); assert.equal(fake(second.element).byClass("composer-draft-review")[0]!.hidden, false);
  draftStorage().writeOwned("legacy text", null); const third = createComposer(async () => true); third.setOwner(owner("a")); third.render(ready); assert.equal(fake(third.element).byClass("composer-draft-review")[0]!.hidden, false);
}));
test("retired adoption/clear controls cannot transfer or erase a later owner's draft", async () => isolated(async () => {
  const composer = createComposer(async () => true); composer.setOwner(owner("a")); composer.render(ready); composer.fill("parked text"); composer.setOwner(owner("b"));
  const root = fake(composer.element), oldAdopt = root.descendants().find((node) => node.textContent === "Use draft here")!, oldClear = root.descendants().find((node) => node.textContent === "Clear draft")!;
  composer.setOwner(owner("c")); oldAdopt.dispatch("click"); oldClear.dispatch("click"); assert.equal(root.byClass("composer-draft-review")[0]!.hidden, false); assert.equal(root.descendants().find((node) => node.id === "conversationInput")!.value, "parked text");
  root.descendants().find((node) => node.textContent === "Clear draft")!.dispatch("click"); assert.deepEqual(draftStorage().readOwned(), { text: "", owner: "c" });
}));
test("return to current retained draft owner unparks without replacing newer held text", async () => isolated(async () => {
  const composer = createComposer(async () => false); composer.setOwner(owner("a")); composer.render(ready); composer.fill("a draft"); composer.setOwner(owner("b")); composer.fill("newer parked edit"); composer.setOwner(owner("a"));
  const root = fake(composer.element); assert.equal(root.byClass("composer-draft-review")[0]!.hidden, true); assert.equal(root.descendants().find((node) => node.id === "conversationInput")!.value, "newer parked edit");
}));
test("obsolete owner disables dispatch and late failure preserves newer draft", async () => isolated(async () => {
  let live = true; let calls = 0; let finish!: (sent: boolean) => void; const composer = createComposer(() => { calls++; return new Promise((resolve) => { finish = resolve; }); }); composer.setOwner({ ...owner("a"), current: () => live }); composer.render(ready); composer.fill("pending draft");
  const root = fake(composer.element), send = root.descendants().find((node) => node.id === "conversationSendButton")!; send.dispatch("click"); live = false; composer.setOwner(owner("b")); composer.render(ready); composer.fill("newer parked draft"); finish(false); await Promise.resolve(); assert.equal(root.descendants().find((node) => node.id === "conversationInput")!.value, "newer parked draft"); assert.equal(calls, 1);
}));
