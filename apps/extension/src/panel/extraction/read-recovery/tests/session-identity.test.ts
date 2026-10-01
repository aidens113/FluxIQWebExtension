import assert from "node:assert/strict";
import test from "node:test";
import { createExtractionReadRecovery } from "../index";
import type { ExtractionSessionIdentity, ExtractionSessionView } from "../../messages";
const identity = Object.freeze({ sessionId: "synthetic-A", tabId: 11, form: "list" as const });
test("preview operation dispatch captures actual selected extraction identity", async () => {
  const selected = [{ key: "name", handling: "include" as const }], reads: unknown[] = [];
  const helper = createExtractionReadRecovery({ read: async (_columns, expected) => { reads.push(expected); return { ...identity, state: "picked" } as ExtractionSessionView; }, start: async () => identity }, {
    epoch: () => 0, busy: () => false, selection: () => selected, identity: () => identity, acceptIdentity: () => {}, runBusy: work => work(),
    acceptSession: () => {}, acceptPreview: () => {}, showError: () => {}, clearError: () => {}, onChange: () => {}
  });
  await helper.refreshPreview(selected); assert.deepEqual(reads, [identity]); helper.reset();
});

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
function fixture(read: (expected: ExtractionSessionIdentity | undefined) => Promise<ExtractionSessionView | undefined>, initial: ExtractionSessionIdentity | null = identity) {
  let owner = initial ?? undefined, starts = 0, prepares = 0, accepted = 0, retired = 0;
  const selection = [{ key: "name", handling: "include" as const }], reads: unknown[] = [];
  const helper = createExtractionReadRecovery({ read: async (_columns, expected) => { reads.push(expected); return read(expected); }, start: async () => { starts++; return identity; }, prepare: async () => { prepares++; } }, {
    epoch: () => 0, busy: () => false, selection: () => selection, identity: () => owner, acceptIdentity: next => { owner = next; }, runBusy: work => work(),
    acceptSession: session => { accepted++; if (!session) retired++; }, acceptPreview: () => { accepted++; }, showError: () => {}, clearError: () => {}, onChange: () => {}
  });
  return { helper, reads, selection, changeOwner: () => { owner = Object.freeze({ ...identity, sessionId: "synthetic-B" }); }, accepted: () => accepted, retired: () => retired, starts: () => starts, prepares: () => prepares };
}
test("identity change without epoch suppresses old response and cannot unlock newer read", async () => {
  const old = deferred<ExtractionSessionView | undefined>(), next = deferred<ExtractionSessionView | undefined>(); let calls = 0;
  const view = fixture(() => ++calls === 1 ? old.promise : next.promise); const first = view.helper.refresh(); view.changeOwner(); const second = view.helper.refresh();
  old.resolve({ ...identity, state: "picked" }); await first; await view.helper.refresh(); assert.equal(calls, 2); assert.equal(view.accepted(), 0);
  next.resolve(undefined); await second; assert.equal(view.accepted(), 1); view.helper.reset();
});
test("first acknowledged binding retains prepare milestone and captured read tuple", async () => {
  const view = fixture(async () => ({ ...identity, state: "picking" }), null); await view.helper.beginPick(); await view.helper.refresh();
  assert.equal(view.starts(), 1); assert.equal(view.prepares(), 1); assert.deepEqual(view.reads, [identity]); view.helper.reset();
});
test("missing bound preview retires selected session rather than publishes empty replacement", async () => {
  const view = fixture(async () => undefined); await view.helper.refreshPreview(view.selection); assert.equal(view.retired(), 1); assert.deepEqual(view.reads, [identity]); view.helper.reset();
});
test("retained failed ticket is inert when its immutable owner changes", async () => {
  const view = fixture(async () => { throw new Error("Synthetic failure"); }); await view.helper.refresh(); const ticket = view.helper.state().ticket; assert.ok(ticket);
  view.changeOwner(); await view.helper.retry(ticket); assert.equal(view.reads.length, 1); assert.equal(view.helper.state().ticket, undefined); view.helper.reset();
});
test("bound uncertain-start verification reads the selected ID without discovery", async () => {
  const reads: unknown[] = []; let failed = true;
  const helper = createExtractionReadRecovery({ read: async (_columns, expected) => { reads.push(expected); return { ...identity, state: "picking" }; }, start: async () => { if (failed) { failed = false; throw new Error("Synthetic start failure"); } return identity; } }, {
    epoch: () => 0, busy: () => false, selection: () => undefined, identity: () => identity, acceptIdentity: () => {}, runBusy: work => work(), acceptSession: () => {}, acceptPreview: () => {}, showError: () => {}, clearError: () => {}, onChange: () => {}
  });
  await helper.beginPick(); const ticket = helper.state().ticket; assert.ok(ticket); await helper.retry(ticket); assert.deepEqual(reads, [identity]); helper.reset();
});
