import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import type { CDPSession, Page } from "@playwright/test";
import { extensionViewPanelDriver } from "../panel-driver.js";

const PANEL_URL = "chrome-extension://abcdefgh/sidepanel/index.html";

type Box = { left: number; top: number; width: number; height: number };
type FakeButton = { textContent: string; disabled: boolean; tagName: string; box: Box; getClientRects(): unknown[]; getBoundingClientRect(): Box; scrollIntoView(): void; contains(node: unknown): boolean };
type Sent = { method: string; params: Record<string, unknown> };

function button(label: string, box: Box, disabled = false): FakeButton {
  const made: FakeButton = {
    textContent: ` ${label} `,
    disabled,
    tagName: "BUTTON",
    box,
    getClientRects: () => [box],
    getBoundingClientRect: () => box,
    scrollIntoView: () => undefined,
    contains: node => node === made,
  };
  return made;
}

/**
 * The side panel's document as a vm context, so the press script runs as
 * Chrome would run it (`Runtime.evaluate` of its source text), and a CDP
 * session that answers like Chrome's for the control tab and the side panel
 * target: a released mouse button over a button clicks it with `isTrusted`
 * as given and grants the view activation.
 */
function fakeChrome(buttons: FakeButton[], input: { trusted: boolean } = { trusted: true }) {
  const listeners = new Set<(event: unknown) => void>();
  const activation = { isActive: false };
  const inside = (box: Box, x: number, y: number) => x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
  const panel = vm.createContext({
    document: {
      querySelectorAll: (selector: string) => selector === "button" ? buttons : [],
      elementFromPoint: (x: number, y: number) => buttons.find(candidate => inside(candidate.box, x, y)) ?? null,
    },
    navigator: { userActivation: activation },
    addEventListener: (type: string, listener: (event: unknown) => void) => type === "click" && listeners.add(listener),
    removeEventListener: (type: string, listener: (event: unknown) => void) => type === "click" && listeners.delete(listener),
  });
  const sent: Sent[] = [];
  const inTarget: Sent[] = [];
  const events = new Map<string, Set<(event: { sessionId: string; message: string }) => void>>();
  const reply = (message: object) => setImmediate(() => {
    for (const listener of events.get("Target.receivedMessageFromTarget") ?? []) listener({ sessionId: "panel-session", message: JSON.stringify(message) });
  });
  const answerInTarget = ({ id, method, params }: { id: number; method: string; params: Record<string, unknown> }) => {
    inTarget.push({ method, params });
    if (method === "Runtime.evaluate") {
      const value = vm.runInContext(String(params.expression), panel);
      return reply({ id, result: { result: { type: "object", value: JSON.parse(JSON.stringify(value)) } } });
    }
    if (method === "Input.dispatchMouseEvent" && params.type === "mousePressed") activation.isActive = true;
    if (method === "Input.dispatchMouseEvent" && params.type === "mouseReleased") {
      const target = buttons.find(candidate => inside(candidate.box, Number(params.x), Number(params.y)));
      if (target) for (const listener of [...listeners]) listener({ isTrusted: input.trusted, target });
    }
    return reply({ id, result: {} });
  };
  const session = {
    detached: false,
    async send(method: string, params: Record<string, unknown> = {}) {
      sent.push({ method, params });
      if (method === "Target.getTargetInfo") return { targetInfo: { targetId: "control-tab", type: "page", url: PANEL_URL } };
      if (method === "Target.getTargets") return { targetInfos: [
        { targetId: "control-tab", type: "page", url: PANEL_URL },
        { targetId: "scenario-tab", type: "page", url: "http://127.0.0.1:4000/" },
        { targetId: "side-panel", type: "page", url: PANEL_URL },
      ] };
      if (method === "Target.attachToTarget") return { sessionId: "panel-session" };
      if (method === "Target.sendMessageToTarget") {
        answerInTarget(JSON.parse(String(params.message)));
        return {};
      }
      return {};
    },
    on(event: string, listener: (event: { sessionId: string; message: string }) => void) {
      events.set(event, (events.get(event) ?? new Set()).add(listener));
    },
    off(event: string, listener: (event: { sessionId: string; message: string }) => void) {
      events.get(event)?.delete(listener);
    },
    async detach() {
      session.detached = true;
    },
  };
  const control = { url: () => PANEL_URL } as unknown as Page;
  const driver = extensionViewPanelDriver(control, "sidepanel/index.html", async () => session as unknown as CDPSession);
  return { driver, sent, inTarget, session, listeners, activation };
}

test("a side-panel press attaches to the panel's own target, finds the button, and releases the left mouse button at its centre", async () => {
  const chrome = fakeChrome([button("No", { left: 10, top: 200, width: 60, height: 30 }), button("Yes", { left: 100, top: 200, width: 80, height: 30 })]);
  await chrome.driver.press("Yes", 1_000);
  const flow = chrome.sent.map(entry => entry.method === "Target.sendMessageToTarget" ? JSON.parse(String(entry.params.message)).method : entry.method);
  assert.deepEqual(flow.slice(0, 7), ["Target.getTargetInfo", "Target.getTargets", "Target.attachToTarget", "Runtime.evaluate", "Input.dispatchMouseEvent", "Input.dispatchMouseEvent", "Input.dispatchMouseEvent"]);
  assert.deepEqual(chrome.sent.find(entry => entry.method === "Target.attachToTarget")?.params, { targetId: "side-panel", flatten: false });
  const mouse = chrome.inTarget.filter(entry => entry.method === "Input.dispatchMouseEvent").map(entry => entry.params);
  assert.deepEqual(mouse, [
    { type: "mouseMoved", x: 140, y: 215, button: "none", buttons: 0, clickCount: 0 },
    { type: "mousePressed", x: 140, y: 215, button: "left", buttons: 1, clickCount: 1 },
    { type: "mouseReleased", x: 140, y: 215, button: "left", buttons: 0, clickCount: 1 },
  ]);
  assert.ok(chrome.inTarget.filter(entry => entry.method === "Runtime.evaluate").length >= 2, "the press is confirmed by reading the panel's watch");
  assert.equal(chrome.listeners.size, 0, "the click watch is removed once it saw the press");
  assert.deepEqual(chrome.sent.at(-1), { method: "Target.detachFromTarget", params: { sessionId: "panel-session" } });
  assert.equal(chrome.session.detached, true);
});

test("a side-panel press with no enabled button of that label reports it as not shown yet and sends no mouse input", async () => {
  const chrome = fakeChrome([button("Yes", { left: 100, top: 200, width: 80, height: 30 }, true), button("Yes please", { left: 10, top: 300, width: 80, height: 30 })]);
  await assert.rejects(chrome.driver.press("Yes", 50), /showed no enabled "Yes" button to press: not shown yet/);
  assert.equal(chrome.inTarget.filter(entry => entry.method === "Input.dispatchMouseEvent").length, 0);
  assert.equal(chrome.listeners.size, 0);
  assert.equal(chrome.session.detached, true);
});

test("a press that reaches the button untrusted fails at once instead of pressing again", async () => {
  const chrome = fakeChrome([button("Yes", { left: 100, top: 200, width: 80, height: 30 })], { trusted: false });
  await assert.rejects(chrome.driver.press("Yes", 5_000), /reached the side panel as untrusted input/);
  assert.equal(chrome.inTarget.filter(entry => entry.method === "Input.dispatchMouseEvent" && entry.params.type === "mouseReleased").length, 1);
});
