import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { targetCore } from "../../chat/conversation/tests/target-core";
import { statusWith } from "../../tests/status-fixture";
import { RUNTIME_MESSAGES as M } from "../../../shared/constants";
import { SIMPLE_PANEL_MESSAGES as S } from "../../../shared/protocol";
import { mountPanel } from "../mount-panel";

const settle = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };

async function mounted(body: (view: Awaited<ReturnType<typeof create>>) => void | Promise<void>) {
  await withFakeDocument(async () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const before = { chrome: globals.chrome, window: globals.window };
    const doc = document as unknown as { createElement(tag: string): FakeElement; createElementNS(ns: string, tag: string): FakeElement; activeElement: FakeElement; focused: boolean; focusCalls: FakeElement[]; body: FakeElement; documentElement: FakeElement };
    const make = doc.createElement;
    doc.focused = true;
    doc.focusCalls = [];
    const matches = (el: FakeElement, selector: string): boolean => selector.split(",").some((raw) => {
      const part = raw.trim();
      if (part === "[hidden]") return el.hidden;
      if (part === "[inert]") return Boolean((el as unknown as { inert: boolean }).inert);
      if (part.startsWith(".")) return el.className.split(/\s+/u).includes(part.slice(1));
      if (part.startsWith("#")) return el.id === part.slice(1);
      return el.tagName.toLowerCase() === part;
    });
    doc.createElement = (tag) => {
      const el = make(tag);
      const captures = new Map<string, Array<(event: { type: string; [key: string]: unknown }) => void>>();
      const add = el.addEventListener.bind(el);
      Object.defineProperties(el, { ownerDocument: { value: doc }, parentElement: { get: () => el.parentNode }, isConnected: { get: () => el === doc.body || doc.body?.descendants().includes(el) } });
      const closest = (selector: string) => { for (let node: FakeElement | null = el; node; node = node.parentNode) if (matches(node, selector)) return node; return null; };
      Object.assign(el, {
        contains: (node: FakeElement) => node === el || el.descendants().includes(node), closest,
        getClientRects: () => el.isConnected && !closest("[hidden], [inert]") ? [{}] : [],
        querySelectorAll: (selector: string) => el.descendants().filter((node) => matches(node, selector)),
        querySelector: (selector: string) => el.descendants().find((node) => matches(node, selector)) ?? null,
        classList: { contains: (name: string) => el.className.split(/\s+/u).includes(name), toggle: (name: string, on: boolean) => { const names = new Set(el.className.split(/\s+/u).filter(Boolean)); if (on) names.add(name); else names.delete(name); el.className = [...names].join(" "); } }
      });
      el.focus = () => { if (!el.disabled && !closest("[hidden], [inert]")) { doc.activeElement = el; doc.focusCalls.push(el); } };
      const remove = el.removeChild.bind(el);
      el.removeChild = (node) => { if (node === doc.activeElement || (node instanceof FakeElement && node.descendants().includes(doc.activeElement))) doc.activeElement = doc.body; remove(node); };
      el.addEventListener = (type, listener, capture?: unknown) => { if (capture) captures.set(type, [...(captures.get(type) ?? []), listener]); else add(type, listener); };
      Object.assign(el, { capture: captures });
      el.dispatch = (type, fields = {}) => {
        const path: FakeElement[] = []; for (let node: FakeElement | null = el; node; node = node.parentNode) path.push(node);
        const event = { type, target: el, ...fields };
        for (const node of [...path].reverse()) for (const listener of (node as unknown as { capture: typeof captures }).capture.get(type) ?? []) listener(event);
        for (const node of path) for (const listener of node.listeners.get(type) ?? []) listener(event);
      };
      return el;
    };
    doc.createElementNS = (_ns, tag) => doc.createElement(tag);
    doc.body = doc.createElement("body"); doc.documentElement = doc.createElement("html"); doc.activeElement = doc.body;
    Object.assign(doc, { hasFocus: () => doc.focused, addEventListener: () => {}, removeEventListener: () => {} });
    const events = new Map<string, () => void>();
    globals.window = { addEventListener: (type: string, listener: () => void) => events.set(type, listener), setTimeout, clearTimeout };
    try { await body(await create(doc, globals)); } finally { events.get("pagehide")?.(); await settle(); globals.chrome = before.chrome; globals.window = before.window; }
  });
}

async function create(doc: { body: FakeElement; activeElement: FakeElement; focused: boolean; focusCalls: FakeElement[] }, globals: Record<string, unknown>) {
  const core = targetCore([]);
  const status = statusWith({ connectionState: "connected", paired: true });
  const listeners = new Set<(message: unknown) => void>();
  let refuseChat = false;
  globals.chrome = { runtime: { onMessage: { addListener: (listener: (message: unknown) => void) => listeners.add(listener), removeListener: (listener: (message: unknown) => void) => listeners.delete(listener) }, sendMessage: (message: { type: string }, done: (reply: unknown) => void) => {
    if (message.type === M.getStatus) done({ ok: true, status });
    else if (message.type === S.listAutomations) done({ ok: true, payload: { flows: [{ flowId: "f", name: "Orders" }], runs: [] } });
    else if (message.type === "extractionGetSession") done({ ok: true });
    else if (refuseChat && message.type === M.panelConversationRead) done({ ok: false, error: "Unknown FluxIQ extension message." });
    else void core.request(message).then((reply) => done(reply.ok ? reply.value : { ok: false }));
  } } };
  const root = fake(document.createElement("div")); doc.body.append(root);
  mountPanel(root as unknown as HTMLElement, "sidepanel");
  await settle();
  const byId = (id: string) => root.descendants().find((node) => node.id === id)!;
  const tab = byId("panelTab-automations"); tab.focus(); tab.dispatch("click"); await settle();
  const row = root.byClass("automation-row")[0]!;
  assert.ok(row, "actual shell loaded automation rows");
  return { root, doc, row, core, byId, refuse: () => { refuseChat = true; }, push: () => { for (const listener of listeners) listener({ type: M.statusChanged, status }); } };
}

test("focused row descendant activation opens target, shows Chat, then focuses enabled composer", async () => mounted(async ({ row, core, byId, doc }) => {
  const box = byId("conversationInput");
  const focus = box.focus.bind(box);
  box.focus = () => { assert.equal(byId("panelScreen-chat").hidden, false); assert.equal(byId("panelScreen-automations").hidden, true); assert.match(box.placeholder, /Orders/u); focus(); };
  row.focus(); row.children[0]!.dispatch("click");
  assert.ok(doc.activeElement === box, "focused row hands off after showing Chat");
  await settle();
  assert.ok(core.sent.some((message) => message.type === M.panelConversationRead && message.kind === "list" && message.subjectId === "f"));
}));

test("unavailable composer hands focused activation to selected visible Chat tab", async () => mounted(async (view) => {
  view.refuse(); view.row.focus(); view.row.dispatch("click"); await settle();
  view.byId("panelTab-automations").dispatch("click"); await settle();
  view.row.focus(); view.row.dispatch("click");
  assert.ok(view.doc.activeElement === view.byId("panelTab-chat"), "unavailable composer uses Chat tab");
  assert.equal(view.byId("panelTab-chat").getAttribute("aria-selected"), "true");
}));

test("external focus, unfocused document and hidden source never hand off", async () => {
  for (const condition of ["external", "unfocused", "hidden", "document-hidden"] as const) await mounted(({ row, doc, root }) => {
    const outside = fake(document.createElement("input")); doc.body.append(outside);
    row.focus();
    if (condition === "external") outside.focus();
    if (condition === "unfocused") doc.focused = false;
    if (condition === "hidden") root.hidden = true;
    if (condition === "document-hidden") Object.assign(document, { visibilityState: "hidden" });
    const count = doc.focusCalls.length;
    row.dispatch("click");
    assert.equal(doc.focusCalls.length, count, condition);
  });
});

test("passive status/reconnect draws preserve external focus after navigation", async () => mounted(async ({ row, doc, push }) => {
  row.focus(); row.dispatch("click");
  const outside = fake(document.createElement("input")); doc.body.append(outside); outside.focus();
  const count = doc.focusCalls.length;
  push(); await settle();
  assert.equal(doc.activeElement, outside);
  assert.equal(doc.focusCalls.length, count);
}));

test("native keyboard click follows the same exact focused-row handoff", async () => mounted(({ row, byId, doc }) => {
  row.focus(); row.dispatch("click", { detail: 0 });
  assert.ok(doc.activeElement === byId("conversationInput"));
}));

test("unconsumed capture expires before a later programmatic row handler", async () => mounted(async ({ row, doc }) => {
  const handlers = row.listeners.get("click")!;
  row.listeners.set("click", []);
  row.focus(); row.dispatch("click"); await settle();
  const count = doc.focusCalls.length;
  for (const handler of handlers) handler({ type: "click", target: row });
  assert.equal(doc.focusCalls.length, count, "old capture cannot authorize passive navigation focus");
}));
