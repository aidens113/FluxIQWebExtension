import assert from "node:assert/strict";
import test from "node:test";
import { EXTRACTION_CONTENT_MESSAGES as C, EXTRACTION_RUNTIME_MESSAGES as M, type ExtractionPreviewColumn } from "../../shared/extraction-messages";
import { clearExtractionTab, handleExtractionControl, type ExtractionControlDeps } from "../extraction";
import { AUTOMATION_TAB, harness, responseOf, sidepanel, startAndPick } from "./extraction-harness";

function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const columns = (price: boolean): ExtractionPreviewColumn[] => [{ key: "product_name", handling: "include" }, { key: "price", handling: price ? "include" : "exclude" }];
const empty: ExtractionPreviewColumn[] = [{ key: "product_name", handling: "exclude" }, { key: "price", handling: "exclude" }, { key: "card", handling: "exclude" }];
const rows = (price = false) => [{ product_name: "Synthetic name", ...(price ? { price: "Synthetic price" } : {}) }];
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function fixture() {
  const h = harness(), id = await startAndPick(h), calls: { request: Record<string, unknown>; response: ReturnType<typeof deferred<unknown>> }[] = [];
  const deps: ExtractionControlDeps = { ...h.deps, sendToTab: async <T,>(tab: number, message: unknown, frame?: number): Promise<T> => {
    const request = message as Record<string, unknown>;
    if (request.type !== C.preview) return h.deps.sendToTab<T>(tab, message, frame);
    assert.equal(tab, AUTOMATION_TAB); assert.equal(frame, 0); assert.equal(request.limit, 20);
    const response = deferred<unknown>(); calls.push({ request, response }); return await response.promise as T;
  } };
  const read = (fields?: readonly ExtractionPreviewColumn[]) => handleExtractionControl({ type: M.getSession, sessionId: id, ...(fields ? { fields } : {}) }, sidepanel, h.manager, deps).then(responseOf);
  const session = h.deps.sessions.get(id)!;
  return { ...h, id, deps, calls, read, session };
}
const preview = (response: Record<string, unknown>) => (response.session as { preview: Record<string, string | null>[] }).preview;

test("all-excluded selection erases stored and replied broad preview without another page read", async () => {
  const f = await fixture(); const broad = f.read(columns(true)); await settle(); f.calls[0]!.response.resolve({ ok: true, rows: rows(true) }); await broad;
  const response = await f.read(empty); assert.deepEqual(f.session.preview, []); assert.deepEqual(preview(response), []); assert.equal(f.calls.length, 1);
});
test("old broad success cannot overwrite a newer narrower successful selection", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); const b = f.read(columns(false)); await settle();
  f.calls[1]!.response.resolve({ ok: true, rows: rows() }); await b; f.calls[0]!.response.resolve({ ok: true, rows: rows(true) }); const response = await a;
  assert.deepEqual(f.session.preview, rows()); assert.deepEqual(preview(response), rows()); assert.equal(f.session.previewKey, "product_name");
});
test("obsolete broad refusal cannot clear newer narrow success", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); const b = f.read(columns(false)); await settle();
  f.calls[1]!.response.resolve({ ok: true, rows: rows() }); await b; f.calls[0]!.response.resolve({ ok: false, refused: "unreadable_request" }); await a;
  assert.deepEqual(f.session.preview, rows()); assert.equal(f.session.previewKey, "product_name");
});
test("new narrow request erases broad stored rows before its read settles", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); f.calls[0]!.response.resolve({ ok: true, rows: rows(true) }); await a;
  const b = f.read(columns(false)); await settle(); assert.deepEqual(f.session.preview, []); f.calls[1]!.response.resolve({ ok: true, rows: rows() }); await b;
});
test("deleted captured session is absent after deferred preview settles", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); clearExtractionTab(AUTOMATION_TAB, f.deps); f.calls[0]!.response.resolve({ ok: true, rows: rows(true) });
  assert.deepEqual(await a, { ok: true }); assert.equal(f.deps.sessions.get(f.id), undefined); assert.deepEqual(f.session.preview, []);
});


test("same-key pending reads join one content operation and committed success stays cached", async () => {
  const f = await fixture(); const a = f.read(columns(false)); const b = f.read(columns(false)); await settle(); assert.equal(f.calls.length, 1);
  f.calls[0]!.response.resolve({ ok: true, rows: rows() }); assert.deepEqual(preview(await a), rows()); assert.deepEqual(preview(await b), rows());
  await f.read(columns(false)); assert.equal(f.calls.length, 1);
});
test("old finally cannot release the current narrower pending lock", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); const b = f.read(columns(false)); await settle();
  f.calls[0]!.response.resolve({ ok: true, rows: rows(true) }); assert.deepEqual(preview(await a), []);
  const joined = f.read(columns(false)); await settle(); assert.equal(f.calls.length, 2); f.calls[1]!.response.resolve({ ok: true, rows: rows() }); await b; await joined;
});
test("obsolete transport rejection preserves newer successful rows and cache", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); const b = f.read(columns(false)); await settle();
  f.calls[1]!.response.resolve({ ok: true, rows: rows() }); await b; f.calls[0]!.response.reject(new Error("Synthetic rejection")); await a;
  assert.deepEqual(f.session.preview, rows()); await f.read(columns(false)); assert.equal(f.calls.length, 2);
});
test("empty selection invalidates pending broad work and expansion reads afresh", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); const erased = await f.read(empty);
  assert.deepEqual(preview(erased), []); assert.deepEqual(f.session.preview, []);
  f.calls[0]!.response.resolve({ ok: true, rows: rows(true) }); assert.deepEqual(preview(await a), []); assert.equal(f.session.previewKey, undefined);
  const b = f.read(columns(false)); await settle(); assert.equal(f.calls.length, 2); f.calls[1]!.response.resolve({ ok: true, rows: rows() }); await b;
});
test("empty selection before queued dispatch sends no page read", async () => {
  const f = await fixture(); const a = f.read(columns(true)); const b = f.read(empty); await a; await b; assert.equal(f.calls.length, 0);
});
for (const rejected of [false, true]) test("same-ID replacement fences old object and its completion: " + rejected, async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); const replacement = f.deps.sessions.start(f.id, AUTOMATION_TAB, "list");
  if (rejected) f.calls[0]!.response.reject(new Error("Synthetic rejection")); else f.calls[0]!.response.resolve({ ok: true, rows: rows(true) });
  assert.deepEqual(await a, { ok: true }); assert.equal(f.deps.sessions.get(f.id), replacement); assert.deepEqual(replacement.preview, []); assert.deepEqual(f.session.preview, []);
});
test("replacement session's preview remains independent of old completion", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); const next = f.deps.sessions.start("replacement", AUTOMATION_TAB, "list");
  f.deps.sessions.picked(next.sessionId, AUTOMATION_TAB, f.session.proposal!); f.deps.sessions.setPreview(next.sessionId, "product_name", rows());
  f.calls[0]!.response.resolve({ ok: true, rows: rows(true) }); assert.deepEqual(await a, { ok: true }); assert.deepEqual(next.preview, rows());
});
test("allowed source keys cap injected content rows and retain null/missing with20-row bound", async () => {
  const f = await fixture(); const a = f.read(columns(false)); await settle();
  const returned = Array.from({ length: 24 }, (_, i) => ({ product_name: i === 0 ? null : "Synthetic name", price: "Excluded synthetic", card: "Excluded synthetic", renamed: "Wrong namespace" }));
  f.calls[0]!.response.resolve({ ok: true, rows: returned }); const response = preview(await a);
  assert.equal(response.length, 20); assert.deepEqual(response[0], { product_name: null }); assert.deepEqual(Object.keys(response[1]!), ["product_name"]); assert.equal(f.session.preview.length, 20);
  assert.equal(JSON.stringify(f.session.preview).includes("Excluded synthetic"), false); returned[1]!.product_name = "Changed source"; assert.equal(f.session.preview[1]!.product_name, "Synthetic name");
});
test("missing and invalid cells are absent rather than invented empty values", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle();
  f.calls[0]!.response.resolve({ ok: true, rows: [{ product_name: null }, { price: 42 }, { product_name: "Synthetic name", price: "" }] });
  assert.deepEqual(preview(await a), [{ product_name: null }, {}, { product_name: "Synthetic name", price: "" }]);
});
test("older narrow caller never receives newer broadened cells", async () => {
  const f = await fixture(); const a = f.read(columns(false)); await settle(); const b = f.read(columns(true)); await settle();
  f.calls[1]!.response.resolve({ ok: true, rows: rows(true) }); assert.deepEqual(preview(await b), rows(true)); f.calls[0]!.response.resolve({ ok: true, rows: rows() });
  assert.deepEqual(preview(await a), rows()); assert.deepEqual(f.session.preview, rows(true));
});
test("each reply is independent from current store and other replies", async () => {
  const f = await fixture(); const a = f.read(columns(false)); await settle(); f.calls[0]!.response.resolve({ ok: true, rows: rows() }); const first = preview(await a), second = preview(await f.read(columns(false)));
  first[0]!.product_name = "Changed reply"; first.push({ product_name: "Added reply" }); assert.deepEqual(f.session.preview, rows()); assert.deepEqual(second, rows());
});
for (const rejected of [false, true]) test("current failure clears cache and same-key retry rereads: " + rejected, async () => {
  const f = await fixture(); const a = f.read(columns(false)); await settle();
  if (rejected) f.calls[0]!.response.reject(new Error("Synthetic rejection")); else f.calls[0]!.response.resolve({ ok: false, refused: "unreadable_request" });
  assert.deepEqual(preview(await a), []); assert.equal(f.session.previewKey, undefined); const b = f.read(columns(false)); await settle(); assert.equal(f.calls.length, 2);
  f.calls[1]!.response.resolve({ ok: true, rows: rows() }); assert.deepEqual(preview(await b), rows());
});
test("recording a pending session returns current recorded state without resurrected rows", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); f.deps.sessions.markRecorded(f.id); f.calls[0]!.response.resolve({ ok: true, rows: rows(true) });
  const response = await a; assert.equal((response.session as { state: string }).state, "recorded"); assert.deepEqual(preview(response), []); assert.deepEqual(f.session.preview, []);
});
test("changed proposal retires old request publication and commit", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); f.session.state = "picking"; f.deps.sessions.picked(f.id, AUTOMATION_TAB, { ...f.session.proposal!, item: "ul.replacement > li" });
  f.calls[0]!.response.resolve({ ok: true, rows: rows(true) }); assert.deepEqual(await a, { ok: true }); assert.deepEqual(f.session.preview, []);
});

test("explicit preview clear invalidates old completion without releasing a new pending read", async () => {
  const f = await fixture(); const a = f.read(columns(true)); await settle(); f.deps.sessions.clearPreview(f.id);
  const b = f.read(columns(false)); await settle(); f.calls[0]!.response.resolve({ ok: true, rows: rows(true) }); assert.deepEqual(preview(await a), []);
  const joined = f.read(columns(false)); await settle(); assert.equal(f.calls.length, 2); f.calls[1]!.response.resolve({ ok: true, rows: rows() }); await b; await joined;
});
test("another tab's independent session is unchanged by pending-session removal", async () => {
  const f = await fixture(); const other = f.deps.sessions.start("other-tab", AUTOMATION_TAB + 1, "list");
  f.deps.sessions.picked(other.sessionId, other.tabId, f.session.proposal!); f.deps.sessions.setPreview(other.sessionId, "product_name", rows());
  const a = f.read(columns(true)); await settle(); f.deps.sessions.clear(f.id); f.calls[0]!.response.resolve({ ok: true, rows: rows(true) });
  assert.deepEqual(await a, { ok: true }); assert.deepEqual(other.preview, rows()); assert.equal(f.deps.sessions.get(other.sessionId), other);
});
