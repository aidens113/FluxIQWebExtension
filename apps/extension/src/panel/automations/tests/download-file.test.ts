import assert from "node:assert/strict";
import test from "node:test";
import { downloadFile } from "../download-file";

function environment(failure?: "create" | "append" | "click" | "remove" | "revoke") {
  const prior = { document: Object.getOwnPropertyDescriptor(globalThis, "document"), timer: globalThis.setTimeout, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const revoked: string[] = [], callbacks: (() => void)[] = []; let clicks = 0, removals = 0;
  const link = { href: "", download: "", hidden: false, click() { clicks++; if (failure === "click") throw new Error("synthetic-click"); }, remove() { removals++; if (failure === "remove") throw new Error("synthetic-remove"); } };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement() { if (failure === "create") throw new Error("synthetic-create"); return link; }, body: { append() { if (failure === "append") throw new Error("synthetic-append"); } } } });
  URL.createObjectURL = () => "blob:synthetic"; URL.revokeObjectURL = (url) => { revoked.push(url); if (failure === "revoke") throw new Error("synthetic-revoke"); };
  globalThis.setTimeout = ((callback: () => void) => { callbacks.push(callback); return 1; }) as unknown as typeof setTimeout;
  return { link, revoked, callbacks, clicks: () => clicks, removals: () => removals, restore() { URL.createObjectURL = prior.create; URL.revokeObjectURL = prior.revoke; globalThis.setTimeout = prior.timer; if (prior.document) Object.defineProperty(globalThis, "document", prior.document); else Reflect.deleteProperty(globalThis, "document"); } };
}

test("successful download clicks once and releases owned resources on a later turn", () => {
  const env = environment(); try { downloadFile("synthetic.csv", "text/csv", "synthetic"); assert.equal(env.clicks(), 1); assert.equal(env.removals(), 1); assert.equal(env.link.download, "synthetic.csv"); assert.deepEqual(env.revoked, []); env.callbacks[0]!(); assert.deepEqual(env.revoked, ["blob:synthetic"]); } finally { env.restore(); }
});
for (const failure of ["create", "append", "click"] as const) test(`failed ${failure} still releases the owned URL`, () => {
  const env = environment(failure); try { assert.throws(() => downloadFile("synthetic.csv", "text/csv", "synthetic")); assert.equal(env.callbacks.length, 1); env.callbacks[0]!(); assert.deepEqual(env.revoked, ["blob:synthetic"]); } finally { env.restore(); }
});
test("best-effort link cleanup cannot turn a successful click into failed delivery", () => {
  const env = environment("remove"); try { assert.doesNotThrow(() => downloadFile("synthetic.csv", "text/csv", "synthetic")); assert.equal(env.clicks(), 1); env.callbacks[0]!(); assert.deepEqual(env.revoked, ["blob:synthetic"]); } finally { env.restore(); }
});
test("deferred URL cleanup does not leak browser exceptions", () => {
  const env = environment("revoke"); try { downloadFile("synthetic.csv", "text/csv", "synthetic"); assert.doesNotThrow(() => env.callbacks[0]!()); assert.deepEqual(env.revoked, ["blob:synthetic"]); } finally { env.restore(); }
});
