import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, fake, withFakeDocument } from "./fake-dom";
import { createChatPanel } from "../chat-panel";
import { targetCore } from "../conversation/tests/target-core";
import { RUNTIME_MESSAGES as M } from "../../../shared/constants";
import { statusWith } from "../../tests/status-fixture";
import type { PanelStore } from "../../state";

async function mounted(body: (view: Awaited<ReturnType<typeof create>>) => void | Promise<void>) {
  await withFakeDocument(async () => {
    const doc = document as unknown as { createElement(tag: string): FakeElement; activeElement: FakeElement; body: FakeElement; focused: boolean; calls: FakeElement[] };
    const make = doc.createElement; doc.focused = true; doc.calls = [];
    doc.createElement = (tag) => {
      const el = make(tag);
      Object.defineProperties(el, { ownerDocument: { value: doc }, parentElement: { get: () => el.parentNode }, isConnected: { get: () => el === doc.body || doc.body?.descendants().includes(el) } });
      const matches = (node: FakeElement, selector: string) => selector.startsWith(".") ? node.className.split(/\s+/u).includes(selector.slice(1)) : selector.startsWith("#") ? node.id === selector.slice(1) : selector === "[hidden]" ? node.hidden : selector === "[inert]" ? Boolean((node as unknown as { inert: boolean }).inert) : node.tagName.toLowerCase() === selector;
      const closest = (selector: string) => { for (let node: FakeElement | null = el; node; node = node.parentNode) if (selector.split(",").some((part) => matches(node!, part.trim()))) return node; return null; };
      Object.assign(el, { contains: (node: FakeElement) => node === el || el.descendants().includes(node), closest, matches: (selector: string) => matches(el, selector), getClientRects: () => el.isConnected && !closest("[hidden], [inert]") ? [{}] : [], querySelector: (selector: string) => el.descendants().find((node) => matches(node, selector)) ?? null, classList: { contains: (name: string) => el.className.split(/\s+/u).includes(name) } });
      el.focus = () => { if (!el.disabled && !closest("[hidden], [inert]")) { doc.activeElement = el; doc.calls.push(el); } };
      return el;
    };
    doc.body = doc.createElement("body"); doc.activeElement = doc.body;
    Object.assign(doc, { hasFocus: () => doc.focused });
    try { await body(await create(doc)); } finally { await settle(); }
  });
}

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function create(doc: { body: FakeElement; activeElement: FakeElement; focused: boolean; calls: FakeElement[] }) {
  const core = targetCore([]);
  let refused = false;
  const request: PanelStore["request"] = (message) => refused && message.type === M.panelConversationRead ? Promise.resolve({ ok: false, sentence: "Unsupported", unsupported: true }) : core.request(message);
  const chat = createChatPanel(request, () => ({ element: document.createElement("a"), observe: () => {} }));
  const root = fake(chat.element); doc.body.append(root);
  chat.render(statusWith({ connectionState: "connected" }));
  chat.open({ kind: "automation", flowId: "f", name: "Orders" }); await settle();
  const back = root.byClass("chat-context-back")[0]!;
  const box = root.descendants().find((node) => node.id === "conversationInput")!;
  return { chat, root, back, box, core, doc, refuse: () => { refused = true; } };
}

test("Latest Back moves focused source to enabled composer after context hides", async () => mounted(({ chat, root, back, box, doc }) => {
  back.focus(); back.dispatch("click");
  assert.deepEqual(chat.target(), { kind: "latest" });
  assert.equal(root.byClass("chat-context")[0]!.hidden, true);
  assert.ok(doc.activeElement === box, "focused Back hands off to composer");
}));

test("disabled/hidden composer uses named programmatically focusable Chat fallback", async () => mounted(({ chat, root, back, doc }) => {
  chat.render(statusWith({ connectionState: "disconnected" }));
  back.focus(); back.dispatch("click");
  assert.ok(doc.activeElement === root, "disabled composer hands off to labelled Chat container");
  assert.equal(root.getAttribute("aria-label"), "Chat with FluxIQ");
  assert.equal(root.getAttribute("tabindex"), "-1");
}));

test("unfocused document, hidden source and unrelated focus never transfer", async () => {
  for (const condition of ["unfocused", "hidden", "external", "document-hidden", "detached"] as const) await mounted(({ root, back, doc }) => {
    back.focus();
    if (condition === "unfocused") doc.focused = false;
    if (condition === "hidden") root.hidden = true;
    if (condition === "document-hidden") Object.assign(document, { visibilityState: "hidden" });
    if (condition === "detached") root.remove();
    if (condition === "external") { const outside = fake(document.createElement("input")); doc.body.append(outside); outside.focus(); }
    const count = doc.calls.length;
    back.dispatch("click");
    assert.equal(doc.calls.length, count, condition);
  });
});

test("programmatic opens and late old/new replies never reclaim unrelated focus", async () => mounted(async ({ chat, back, core, doc }) => {
  core.hold = true;
  chat.open({ kind: "automation", flowId: "old", name: "Old" });
  back.focus(); back.dispatch("click");
  const outside = fake(document.createElement("input")); doc.body.append(outside); outside.focus();
  const count = doc.calls.length;
  chat.open({ kind: "automation", flowId: "new", name: "New" });
  chat.render(statusWith({ connectionState: "connected" }));
  core.release(); await settle();
  assert.equal(doc.activeElement, outside);
  assert.equal(doc.calls.length, count);
}));

test("fallback-hidden composer hands Back to the visible named container", async () => mounted(async ({ chat, root, back, doc, refuse }) => {
  refuse(); chat.open({ kind: "automation", flowId: "other", name: "Other" }); await settle();
  assert.equal(root.byClass("chat-dock")[0]!.hidden, true);
  back.focus(); back.dispatch("click");
  assert.ok(doc.activeElement === root);
  assert.equal(root.getAttribute("aria-label"), "Chat with FluxIQ");
}));
