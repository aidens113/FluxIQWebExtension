import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { targetCore } from "../../chat/conversation/tests/target-core";
import { statusWith } from "../../tests/status-fixture";
import { ACTIVITY_MESSAGES as A, type ExtensionActivityState } from "../../../shared/activity/index";
import { RUNTIME_MESSAGES as M } from "../../../shared/constants";
import { SIMPLE_PANEL_MESSAGES as S, type ExtensionStatus } from "../../../shared/protocol";
import { mountPanel } from "../mount-panel";
import { fakeClock } from "./fake-clock";

const settle = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
function status(owner = "a", running = false): ExtensionStatus { return statusWith({ connectionState: "connected", paired: true, gatewayUrl: `ws://synthetic-${owner}.invalid/client`, clientId: "synthetic-client", projectId: "synthetic-project", activeTabUrl: "https://synthetic.invalid/", runtime: { state: running ? "running" : "idle" } }); }
function relay(working: boolean): ExtensionActivityState { return { current: null, recent: [], overlay: "expanded", live: true, display: { activityId: "synthetic-build", subjectKind: "build", phase: "building", headline: "Synthetic", detail: null, step: null, working, outcome: working ? null : "done", sequence: 1 } }; }
async function mounted(body: (view: Awaited<ReturnType<typeof create>>) => void | Promise<void>, first = status()) {
  await withFakeDocument(async () => {
    const globals = globalThis as unknown as Record<string, unknown>; const before = { chrome: globals.chrome, window: globals.window, setInterval: globals.setInterval, clearInterval: globals.clearInterval };
    const clock = fakeClock(); const events = new Map<string, () => void>(); const intervals = new Map<object, () => void>();
    globals.setInterval = (run: () => void) => { const handle = {}; intervals.set(handle, run); return handle; }; globals.clearInterval = (handle: object) => intervals.delete(handle);
    globals.window = { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, addEventListener: (type: string, listener: () => void) => events.set(type, listener) };
    const doc = document as unknown as { createElement(tag: string): FakeElement; createElementNS(ns: string, tag: string): FakeElement; body: FakeElement; documentElement: FakeElement; activeElement: FakeElement };
    const make = doc.createElement;
    doc.createElement = tag => {
      const el = make(tag); Object.defineProperties(el, { ownerDocument: { value: doc }, parentElement: { get: () => el.parentNode } });
      const matches = (node: FakeElement, selector: string) => selector.startsWith("#") ? node.id === selector.slice(1) : selector.startsWith(".") ? node.className.split(/\s+/u).includes(selector.slice(1)) : node.tagName.toLowerCase() === selector;
      Object.assign(el, { contains: (node: FakeElement) => node === el || el.descendants().includes(node), querySelector: (selector: string) => el.descendants().find(node => matches(node, selector)) ?? null,
        querySelectorAll: (selector: string) => el.descendants().filter(node => matches(node, selector)), closest: () => null, getClientRects: () => [{}],
        classList: { contains: (name: string) => el.className.split(/\s+/u).includes(name), toggle: (name: string, on: boolean) => { const names = new Set(el.className.split(/\s+/u).filter(Boolean)); if (on) names.add(name); else names.delete(name); el.className = [...names].join(" "); } } });
      return el;
    };
    doc.createElementNS = (_ns, tag) => doc.createElement(tag); doc.body = doc.createElement("body"); doc.documentElement = doc.createElement("html"); doc.activeElement = doc.body;
    Object.assign(doc, { hasFocus: () => true, addEventListener: () => {}, removeEventListener: () => {} });
    try { await body(await create(globals, doc, clock, first)); } finally { events.get("pagehide")?.(); await settle(); Object.assign(globals, before); }
  });
}
async function create(globals: Record<string, unknown>, doc: { body: FakeElement }, clock: ReturnType<typeof fakeClock>, initial: ExtensionStatus) {
  let latest = initial; const listeners = new Set<(message: unknown) => void>(); const removed: Array<(message: unknown) => void> = [];
  const reads: Array<{ owner: string; done(reply: unknown): void }> = []; const core = targetCore([]); const statusReplies: Array<(reply: unknown) => void> = [];
  globals.chrome = { runtime: { onMessage: { addListener: (listener: (message: unknown) => void) => listeners.add(listener), removeListener: (listener: (message: unknown) => void) => { listeners.delete(listener); removed.push(listener); } }, sendMessage: (message: { type: string }, done: (reply: unknown) => void) => {
    if (message.type === M.getStatus) statusReplies.push(done);
    else if (message.type === A.read) reads.push({ owner: latest.gatewayUrl, done });
    else if (message.type === S.listAutomations) done({ ok: true, payload: { flows: [], runs: [] } });
    else if (message.type === "extractionGetSession") done({ ok: true });
    else void core.request(message).then(reply => done(reply.ok ? reply.value : { ok: false }));
  } } };
  const root = fake(document.createElement("div")); doc.body.append(root); mountPanel(root as unknown as HTMLElement, "sidepanel"); await settle();
  const push = (message: unknown) => { for (const listener of [...listeners]) listener(message); };
  const observe = async (next: ExtensionStatus) => { latest = next; push({ type: M.statusChanged, status: next }); await settle(); };
  const begin = async () => { for (const done of statusReplies) done({ ok: true, status: latest }); await settle(); };
  return { root, clock, reads, listeners, removed, observe, begin, push, record: () => root.descendants().find(node => node.id === "recordButton")!, latest: () => latest };
}
test("same-connected working A to idle B masks foreign held activity immediately", async () => { await mounted(async f => { await f.begin(); f.push({ type: A.changed, state: relay(true) }); f.clock.advance(400); assert.equal(f.record().disabled, true); await f.observe(status("b")); assert.equal(f.record().disabled, false); f.clock.advance(2000); assert.equal(f.record().disabled, false); }); });
test("same-connected idle A to running B uses runtime fallback before current paced feed", async () => { await mounted(async f => { await f.begin(); f.push({ type: A.changed, state: relay(false) }); await f.observe(status("b", true)); f.clock.advance(399); assert.equal(f.record().disabled, false); f.clock.advance(1); assert.equal(f.record().disabled, true); f.push({ type: A.changed, state: relay(false) }); f.clock.advance(1199); assert.equal(f.record().disabled, true); f.clock.advance(1); assert.equal(f.record().disabled, false); }); });
test("old owner reads and retained push listeners cannot publish after A/B/A", async () => { await mounted(async f => {
  await f.begin(); const oldReads = [...f.reads]; const oldListeners = [...f.listeners]; await f.observe(status("b")); await f.observe(status("a"));
  for (const read of oldReads) read.done({ ok: true, state: relay(true) }); for (const listener of oldListeners) listener({ type: A.changed, state: relay(true) }); await settle(); f.clock.advance(400); assert.equal(f.record().disabled, false);
}); });
test("first confirmed status retires unknown read and listener leases", async () => { await mounted(async f => {
  const unknown = [...f.reads]; const oldListeners = [...f.listeners]; await f.begin();
  for (const read of unknown) read.done({ ok: true, state: relay(true) }); for (const listener of oldListeners) listener({ type: A.changed, state: relay(true) }); await settle(); f.clock.advance(400); assert.equal(f.record().disabled, false);
}); });
test("same-owner optional omission and volatile churn preserve paced working authority", async () => { await mounted(async f => {
  await f.begin(); const confirmed = { ...status(), settings: { coreApiUrl: "https://synthetic-core.invalid" } } as ExtensionStatus; await f.observe(confirmed); f.push({ type: A.changed, state: relay(true) }); f.clock.advance(400); const readCount = f.reads.length;
  await f.observe({ ...status(), queueSize: 9, eventCount: 12, sessionId: "volatile", activeTabUrl: "https://synthetic.invalid/other" }); assert.equal(f.record().disabled, true); assert.equal(f.reads.length, readCount);
}); });
test("paired loss retires old paced authority before replacement", async () => { await mounted(async f => { await f.begin(); f.push({ type: A.changed, state: relay(true) }); f.clock.advance(400); const old = [...f.listeners]; await f.observe({ ...status(), paired: false }); await f.observe(status()); for (const listener of old) listener({ type: A.changed, state: relay(true) }); f.clock.advance(400); assert.equal(f.record().disabled, false); }); });
test("unsupported shell feed remains mounted-lifetime sticky through owners and reconnect", async () => { await mounted(async f => {
  await f.begin(); for (const read of [...f.reads]) read.done({ ok: false, error: "Unknown FluxIQ extension message." }); await settle();
  const count = f.reads.length; await f.observe(status("b")); await f.observe({ ...status("b"), connectionState: "disconnected" }); await f.observe(status("b")); assert.equal(f.reads.length, count);
}); });
test("same-owner reconnect preserves pending hold cadence and paced authority", async () => { await mounted(async f => {
  await f.begin(); f.push({ type: A.changed, state: relay(true) }); f.clock.advance(200);
  await f.observe({ ...status(), connectionState: "disconnected", sessionId: "restart" }); await f.observe(status()); f.clock.advance(199); assert.equal(f.record().disabled, false); f.clock.advance(1); assert.equal(f.record().disabled, true);
  await f.observe({ ...status(), runtime: { state: "idle" }, eventCount: 40 }); f.clock.advance(1200); assert.equal(f.record().disabled, true);
}); });
test("replacement starts fresh current-owner delay instead of completing old pending hold", async () => { await mounted(async f => {
  await f.begin(); f.push({ type: A.changed, state: relay(true) }); f.clock.advance(200); await f.observe(status("b", true)); f.clock.advance(399); assert.equal(f.record().disabled, false); f.clock.advance(1); assert.equal(f.record().disabled, true);
}); });
