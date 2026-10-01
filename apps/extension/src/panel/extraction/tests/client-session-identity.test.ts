import assert from "node:assert/strict";
import test from "node:test";
import { startExtractionPick, confirmExtraction, cancelExtraction, readExtractionSession } from "../client";
import { withDialogDom } from "./dialog-dom";
const identity = { sessionId: "real-synthetic-A", tabId: 11, form: "list" as const };
const request = { label: "Synthetic", item: "ul > li", fields: [], itemCount: 3 };
test("start returns actual immutable acknowledged extraction identity", async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true, ...identity }); const result = await startExtractionPick(); assert.deepEqual(result, identity); assert.equal(Object.isFrozen(result), true);
}));
test("bound client requests carry exact selected session ID", async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true, session: { ...identity, state: "picked", preview: [] } });
  await readExtractionSession(undefined, identity); await confirmExtraction(request, identity); await cancelExtraction(identity);
  assert.deepEqual(world.sent.map(message => message.sessionId), [identity.sessionId, identity.sessionId, identity.sessionId]);
}));
test("bound client refuses response identity mismatch instead of publishing replacement", async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true, session: { ...identity, sessionId: "real-synthetic-B", state: "picked" } });
  await assert.rejects(readExtractionSession(undefined, identity), /session|extraction/u);
}));

for (const altered of [{ sessionId: "replacement" }, { tabId: 12 }, { form: "value" }, { sessionId: "" }, { tabId: NaN }, { tabId: -1 }, { form: "unknown" }]) test("bound read rejects altered identity " + JSON.stringify(altered), async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true, session: { ...identity, ...altered, state: "picked" } });
  await assert.rejects(readExtractionSession(undefined, identity), /session|extraction/u);
}));
test("selected missing session remains absent with no implicit second request", async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true }); assert.equal(await readExtractionSession(undefined, identity), undefined);
  assert.equal(world.sent.length, 1); assert.equal(world.sent[0]?.sessionId, identity.sessionId);
}));
test("legacy bare start acknowledgement remains compatible without fabricated identity", async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true }); assert.equal(await startExtractionPick(), undefined);
  world.reply = () => ({ ok: true, sessionId: "real-but-incomplete" }); await assert.rejects(startExtractionPick(), /identity/u);
}));
