import assert from "node:assert/strict";
import test from "node:test";
import { createExtractionReadRecovery, type ExtractionRecoveryTicket } from "../index";
import type { ExtractionPreviewColumn, ExtractionSessionView } from "../../messages";
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const picked: ExtractionSessionView = { state: "picked" };
const columns = (key = "a"): ExtractionPreviewColumn[] => [{ key, handling: "include" }];
function fixture(read: (selection?: readonly ExtractionPreviewColumn[]) => Promise<ExtractionSessionView | undefined> = async () => picked) {
  let epoch = 0, busy = false, selection = columns(), starts = 0, preparations = 0;
  let owner: object | undefined, sentence = "", changed: () => void = () => {}, cleared: () => void = () => {};
  const reads: (readonly ExtractionPreviewColumn[] | undefined)[] = [], accepted: unknown[][] = [];
  let starting: () => Promise<void> = async () => {}, preparing: () => Promise<void> = async () => {};
  const helper = createExtractionReadRecovery({ read: async selection => { reads.push(selection); return read(selection); }, start: async () => { starts++; await starting(); }, prepare: async () => { preparations++; await preparing(); } }, {
    epoch: () => epoch, busy: () => busy, selection: () => selection,
    runBusy: async work => { busy = true; try { await work(); } finally { busy = false; } },
    acceptSession: (session, restore) => accepted.push(["session", session, restore]), acceptPreview: session => accepted.push(["preview", session]),
    showError: (ticket, text) => { owner = ticket; sentence = text; }, clearError: ticket => { if (owner === ticket) { owner = undefined; sentence = ""; } cleared(); }, onChange: () => changed()
  });
  return { helper, reads, accepted, starts: () => starts, preparations: () => preparations, sentence: () => sentence,
    owner: () => owner, select: (next: ExtractionPreviewColumn[]) => { selection = next; }, nextEpoch: () => { epoch++; helper.reset(); },
    onClear: (fn: () => void) => { cleared = fn; },
    onChange: (fn: () => void) => { changed = fn; }, starting: (fn: () => Promise<void>) => { starting = fn; }, preparing: (fn: () => Promise<void>) => { preparing = fn; },
    foreignNotice: () => { owner = {}; sentence = "Foreground notice"; }
  };
}
function ticket(view: ReturnType<typeof fixture>): ExtractionRecoveryTicket { const held = view.helper.state().ticket; assert.ok(held); return held; }

test("session duplicate read locks before dispatch and current retry clears fixed failure", async () => {
  const pending = deferred<ExtractionSessionView | undefined>(); let attempts = 0;
  const view = fixture(() => ++attempts === 1 ? pending.promise : Promise.resolve(picked));
  const first = view.helper.refresh(); await view.helper.refresh(); assert.equal(view.reads.length, 1);
  pending.reject(new Error("synthetic-private-error")); await first; assert.match(view.sentence(), /Couldn't read/); assert.doesNotMatch(view.sentence(), /private/);
  const retry = ticket(view); await view.helper.retry(retry); assert.equal(view.reads.length, 2); assert.equal(view.sentence(), ""); assert.equal(view.helper.state().ticket, undefined); assert.equal(view.starts(), 0); assert.equal(view.preparations(), 0);
});

test("old session finally cannot release new epoch's pending read", async () => {
  const old = deferred<ExtractionSessionView | undefined>(), current = deferred<ExtractionSessionView | undefined>(); let reads = 0;
  const view = fixture(() => ++reads === 1 ? old.promise : current.promise); const first = view.helper.refresh(); view.nextEpoch(); const next = view.helper.refresh();
  old.resolve(picked); await first; await view.helper.refresh(); assert.equal(reads, 2); assert.deepEqual(view.accepted, []);
  current.resolve(picked); await next; assert.equal(view.accepted.length, 1);
});

for (const refused of [false, true]) test("new preview selection suppresses old " + (refused ? "failure" : "success") + " and cleanup", async () => {
  const old = deferred<ExtractionSessionView | undefined>(), current = deferred<ExtractionSessionView | undefined>(); let reads = 0;
  const view = fixture(() => ++reads === 1 ? old.promise : current.promise); const first = view.helper.refreshPreview(columns()); view.select(columns("b")); const next = view.helper.refreshPreview(columns("b"));
  if (refused) old.reject(new Error("old diagnostic")); else old.resolve(picked); await first;
  await view.helper.refreshPreview(columns("b")); assert.equal(reads, 2); assert.deepEqual(view.accepted, []); assert.equal(view.helper.state().ticket, undefined);
  current.resolve(picked); await next; assert.equal(view.accepted.length, 1);
});

test("preview retry holds original ticket/control while pending and clears own error on success", async () => {
  const pending = deferred<ExtractionSessionView | undefined>(); let attempts = 0;
  const view = fixture(() => ++attempts === 1 ? Promise.reject(new Error("diagnostic")) : pending.promise);
  await view.helper.refreshPreview(columns()); const old = ticket(view); const retry = view.helper.retry(old);
  assert.equal(view.helper.state().ticket, old); assert.equal(view.helper.state().pending, true); await view.helper.retry(old); assert.equal(attempts, 2);
  pending.resolve(picked); await retry; assert.equal(view.helper.state().ticket, undefined); assert.equal(view.sentence(), "");
});

test("preview success clears only its own notice owner", async () => {
  let failed = true; const view = fixture(() => failed ? Promise.reject(new Error("diagnostic")) : Promise.resolve(picked));
  await view.helper.refreshPreview(columns()); const retry = ticket(view); view.foreignNotice(); failed = false; await view.helper.retry(retry); assert.equal(view.sentence(), "Foreground notice");
});

test("old preview failure after current successful selection never returns", async () => {
  const old = deferred<ExtractionSessionView | undefined>(); let attempts = 0; const view = fixture(() => ++attempts === 1 ? old.promise : Promise.resolve(picked));
  const first = view.helper.refreshPreview(columns()); view.select(columns("b")); await view.helper.refreshPreview(columns("b")); old.reject(new Error("diagnostic")); await first; assert.equal(view.sentence(), ""); assert.equal(view.helper.state().ticket, undefined);
});

test("new selection invalidates failure ticket and stale Retry dispatches nothing", async () => {
  let failed = true; const view = fixture(() => failed ? Promise.reject(new Error("diagnostic")) : Promise.resolve(picked)); await view.helper.refreshPreview(columns()); const old = ticket(view);
  failed = false; view.select(columns("b")); await view.helper.refreshPreview(columns("b")); const before = view.reads.length; await view.helper.retry(old); assert.equal(view.reads.length, before);
});

test("expired Retry after reset cannot read or mutate", async () => {
  const view = fixture(() => Promise.reject(new Error("diagnostic"))); await view.helper.refresh(); const old = ticket(view); view.nextEpoch(); await view.helper.retry(old); assert.equal(view.reads.length, 1); assert.equal(view.starts(), 0);
});

for (const channel of ["session", "preview", "pick"] as const) test("reentrant reset before " + channel + " dispatch sends nothing", async () => {
  const view = fixture(); let reset = true; view.onChange(() => { if (reset) { reset = false; view.nextEpoch(); } });
  if (channel === "session") await view.helper.refresh(); else if (channel === "preview") await view.helper.refreshPreview(columns()); else await view.helper.beginPick();
  assert.equal(view.reads.length, 0); assert.equal(view.starts(), 0); assert.equal(view.preparations(), 0);
});

test("prepare failure retries preparation once through original busy gate", async () => {
  const view = fixture(); let failed = true; view.preparing(() => failed ? Promise.reject(new Error("Recording refused")) : Promise.resolve());
  await view.helper.beginPick(); assert.equal(view.starts(), 0); assert.equal(view.sentence(), "Recording refused"); const retry = ticket(view); failed = false;
  await view.helper.retry(retry); assert.equal(view.preparations(), 2); assert.equal(view.starts(), 1); assert.equal(view.sentence(), ""); view.helper.reset();
});

test("failed start verifies existing session without repeating prepare or start", async () => {
  const view = fixture(); view.starting(() => Promise.reject(new Error("diagnostic"))); await view.helper.beginPick(); const retry = ticket(view);
  await view.helper.retry(retry); assert.equal(view.reads.length, 1); assert.equal(view.preparations(), 1); assert.equal(view.starts(), 1); assert.deepEqual(view.accepted[0], ["session", picked, true]);
});

test("failed start with absent session retries only start; failed verification remains retryable", async () => {
  let failRead = true; const view = fixture(() => failRead ? Promise.reject(new Error("diagnostic")) : Promise.resolve(undefined));
  let failStart = true; view.starting(() => failStart ? Promise.reject(new Error("diagnostic")) : Promise.resolve()); await view.helper.beginPick(); await view.helper.retry(ticket(view));
  assert.equal(view.starts(), 1); assert.equal(view.preparations(), 1); assert.equal(ticket(view).stage, "start"); failRead = false; failStart = false; await view.helper.retry(ticket(view));
  assert.equal(view.starts(), 2); assert.equal(view.preparations(), 1); view.helper.reset();
});

test("current duplicate prepare retry holds pick lock through deferred preparation", async () => {
  const pending = deferred<void>(); const view = fixture(); let fail = true; view.preparing(() => fail ? Promise.reject(new Error("Recording refused")) : pending.promise);
  await view.helper.beginPick(); const retry = ticket(view); fail = false; const next = view.helper.retry(retry); await view.helper.retry(retry); assert.equal(view.preparations(), 2); pending.resolve(); await next; assert.equal(view.starts(), 1); view.helper.reset();
});

test("fulfilled tagged refusal is preserved while untagged failure stays fixed", async () => {
  let tagged = true; const view = fixture(() => Promise.reject(tagged ? Object.assign(new Error("Background refused"), { extractionRefusal: true }) : new Error("Private diagnostic")));
  await view.helper.refresh(); assert.equal(view.sentence(), "Background refused"); tagged = false; await view.helper.retry(ticket(view)); assert.match(view.sentence(), /Couldn't read/); assert.doesNotMatch(view.sentence(), /Private/);
});

test("600ms timer has one owner and retained old callback is inert after reset", async () => {
  const set = globalThis.setInterval, clear = globalThis.clearInterval; const timers = new Map<number, () => void>(); let id = 0;
  globalThis.setInterval = ((fn: () => void, delay: number) => { assert.equal(delay, 600); timers.set(++id, fn); return id; }) as unknown as typeof setInterval;
  globalThis.clearInterval = ((id: number) => { timers.delete(id); }) as unknown as typeof clearInterval;
  const view = fixture();
  try { view.helper.startPolling(); view.helper.startPolling(); assert.equal(timers.size, 1); const callback = [...timers.values()][0]!; view.helper.reset(); assert.equal(timers.size, 0); callback(); await Promise.resolve(); assert.equal(view.reads.length, 0); }
  finally { view.helper.reset(); globalThis.setInterval = set; globalThis.clearInterval = clear; }
});

test("reentrant epoch reset while clearing prior preview error prevents obsolete dispatch", async () => {
  let failed = true; const view = fixture(() => failed ? Promise.reject(new Error("diagnostic")) : Promise.resolve(picked));
  await view.helper.refreshPreview(columns()); failed = false; view.select(columns("b")); let reset = true;
  view.onClear(() => { if (reset) { reset = false; view.nextEpoch(); } });
  await view.helper.refreshPreview(columns("b")); assert.equal(view.reads.length, 1); assert.equal(view.helper.state().ticket, undefined);
});

test("reentrant reset while clearing start failure prevents old acceptance and poll restart", async () => {
  const view = fixture(); view.starting(() => Promise.reject(new Error("diagnostic"))); await view.helper.beginPick(); const retry = ticket(view); let reset = true;
  view.onClear(() => { if (reset) { reset = false; view.nextEpoch(); } }); await view.helper.retry(retry); assert.deepEqual(view.accepted, []); assert.equal(view.helper.state().ticket, undefined);
});
