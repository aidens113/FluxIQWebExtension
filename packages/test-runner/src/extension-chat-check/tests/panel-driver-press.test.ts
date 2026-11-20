import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import type { CDPSession, Page } from "@playwright/test";
import { extensionViewPanelDriver } from "../panel-driver.js";

const PANEL_URL = "chrome-extension://abcdefgh/sidepanel/index.html";

type Box = { left: number; top: number; width: number; height: number };
type FakeScroller = { tagName: string; box: Box; parentElement: FakeScroller | null; overflowY: "auto" | "hidden"; scrollTop: number; scrollHeight: number; clientHeight: number; clientWidth: number; clientTop: number; clientLeft: number; getBoundingClientRect(): Box; contains(node: unknown): boolean };
type FakeButton = { textContent: string; disabled: boolean; tagName: string; box: Box; parentElement: FakeScroller | null; isConnected: boolean; getClientRects(): unknown[]; getBoundingClientRect(): Box; scrollIntoView(): void; contains(node: unknown): boolean };
type Sent = { method: string; params: Record<string, unknown> };

function button(label: string, box: Box, disabled = false): FakeButton {
  const made: FakeButton = {
    textContent: ` ${label} `,
    disabled,
    tagName: "BUTTON",
    box,
    parentElement: null,
    isConnected: true,
    getClientRects: () => made.isConnected ? [made.box] : [],
    getBoundingClientRect: () => made.isConnected ? made.box : { left: 0, top: 0, width: 0, height: 0 },
    scrollIntoView: () => undefined,
    contains: node => node === made,
  };
  return made;
}

function scroller(box: Box, parentElement: FakeScroller | null = null, overflowY: FakeScroller["overflowY"] = "auto"): FakeScroller {
  const made: FakeScroller = { tagName: "DIV", box, parentElement, overflowY, scrollTop: 0, scrollHeight: box.height * 3, clientHeight: box.height, clientWidth: box.width, clientTop: 0, clientLeft: 0,
    getBoundingClientRect: () => made.box,
    contains(node) {
      let current = node;
      while (current !== null && typeof current === "object") {
        if (current === made) return true;
        current = "parentElement" in current ? current.parentElement : null;
      }
      return false;
    },
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
function fakeChrome(buttons: FakeButton[], input: { trusted: boolean; mutation?: "move" | "replace"; nextBox?: Box; snapBack?: boolean; owners?: FakeScroller[]; overlay?: boolean } = { trusted: true }) {
  const listeners = new Set<(event: unknown) => void>();
  const activation = { isActive: false };
  const inside = (box: Box, x: number, y: number) => x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
  const unclipped = (element: FakeButton | FakeScroller, x: number, y: number): boolean => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) if (!inside(parent.box, x, y)) return false;
    return true;
  };
  const elementAt = (x: number, y: number) => x < 0 || y < 0 || x >= 360 || y >= 655 ? null : input.overlay ? { tagName: "DIV" } : buttons.find(candidate => inside(candidate.box, x, y) && unclipped(candidate, x, y)) ?? input.owners?.find(owner => inside(owner.box, x, y) && unclipped(owner, x, y)) ?? null;
  const initial = buttons[0]!.box;
  let snapping = false;
  if (input.snapBack) buttons[0]!.scrollIntoView = () => {
    buttons[0]!.box = { ...initial, top: (655 - initial.height) / 2 };
    snapping = true;
  };
  const panel = vm.createContext({
    document: {
      querySelectorAll: (selector: string) => selector === "button" ? buttons : [],
      elementFromPoint: elementAt,
      hasFocus: () => true,
      visibilityState: "visible",
    },
    innerWidth: 360, innerHeight: 655, devicePixelRatio: 1, visualViewport: { scale: 1, offsetLeft: 0, offsetTop: 0 },
    getComputedStyle: (element: FakeScroller) => ({ overflowY: element.overflowY ?? "visible", overflowX: "visible" }),
    navigator: { userActivation: activation },
    addEventListener: (type: string, listener: (event: unknown) => void) => ["mousedown", "mouseup", "click"].includes(type) && listeners.add(listener),
    removeEventListener: (type: string, listener: (event: unknown) => void) => ["mousedown", "mouseup", "click"].includes(type) && listeners.delete(listener),
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
    if (method === "Input.dispatchMouseEvent") {
      if (params.type === "mouseWheel") {
        let owner = elementAt(Number(params.x), Number(params.y));
        while (owner && "parentElement" in owner) {
          if ("scrollTop" in owner && owner.overflowY === "auto" && (Number(params.deltaY) < 0 ? owner.scrollTop > 0 : owner.scrollTop + owner.clientHeight < owner.scrollHeight)) break;
          owner = owner.parentElement;
        }
        if (owner && "scrollTop" in owner) {
          const delta = Math.max(-owner.scrollTop, Math.min(Number(params.deltaY), owner.scrollHeight - owner.clientHeight - owner.scrollTop));
          owner.scrollTop += delta;
          for (const element of [...buttons, ...(input.owners ?? [])]) if (element !== owner && owner.contains(element)) element.box = { ...element.box, top: element.box.top - delta };
        }
      }
      if (params.type === "mouseMoved" && snapping) {
        buttons[0]!.box = initial;
        snapping = false;
      }
      if (params.type === "mouseMoved" && input.mutation === "move" && input.nextBox) buttons[0]!.box = input.nextBox;
      if (params.type === "mouseMoved" && input.mutation === "replace") {
        buttons[0]!.isConnected = false;
        buttons[0] = button("Yes", buttons[0]!.box);
      }
      if (params.type === "mousePressed") activation.isActive = true;
      const target = elementAt(Number(params.x), Number(params.y)) ?? { tagName: "BODY" };
      const types = params.type === "mousePressed" ? ["mousedown"] : params.type === "mouseReleased" ? ["mouseup", "click"] : [];
      for (const type of types) for (const listener of [...listeners]) listener({ type, isTrusted: input.trusted, target });
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

for (const mutation of ["move", "replace"] as const) test(`a ${mutation} during delivery retains geometry and event evidence while rejecting the missed press`, async () => {
  const before = { left: 10, top: 200, width: 80, height: 30 };
  const after = { left: 10, top: 80, width: 80, height: 30 };
  const chrome = fakeChrome([button("Yes", before)], { trusted: true, mutation, nextBox: after });
  await assert.rejects(chrome.driver.press("Yes", 1), (error: unknown) => {
    assert.ok(error instanceof Error);
    const detail = JSON.parse(error.message.split("; delivery ")[1]!);
    assert.equal(detail.targetId, "side-panel");
    assert.equal(detail.ownTargetId, "control-tab");
    assert.deepEqual(detail.observation.before.box, before);
    assert.deepEqual(detail.observation.after.box, mutation === "move" ? after : { left: 0, top: 0, width: 0, height: 0 });
    assert.equal(detail.observation.after.connected, mutation === "move");
    assert.deepEqual(detail.observation.events, { down: { seen: true, hit: false }, up: { seen: true, hit: false }, click: { seen: true, hit: false } });
    assert.equal(detail.observation.after.pointHitsButton, false);
    assert.equal(detail.observation.after.visibility, "visible");
    assert.equal(detail.observation.after.focused, true);
    assert.deepEqual(detail.observation.after.viewport, { width: 360, height: 655, dpr: 1, scale: 1, offsetLeft: 0, offsetTop: 0 });
    assert.doesNotMatch(error.message, /textContent|outerHTML|authorization|cookie/i);
    return true;
  });
  assert.equal(chrome.listeners.size, 0);
  assert.equal(chrome.session.detached, true);
});

test("a visible button stays hit-testable when the chat undoes a programmatic recenter", async () => {
  const chrome = fakeChrome([button("Yes", { left: 10, top: 80, width: 80, height: 30 })], { trusted: true, snapBack: true });
  await chrome.driver.press("Yes", 500);
  assert.equal(chrome.inTarget.filter(entry => entry.method === "Input.dispatchMouseEvent" && entry.params.type === "mouseReleased").length, 1);
});

for (const mode of ["inner", "clipped", "outer"] as const) test(`an offscreen button uses trusted wheel on its ${mode} scroll owner, then is located afresh`, async () => {
  const outer = scroller({ left: 0, top: 50, width: 320, height: mode === "inner" ? 500 : 200 });
  const inner = scroller({ left: 20, top: mode === "outer" ? 350 : 100, width: 240, height: mode === "clipped" ? 400 : 200 }, outer);
  const target = button("Yes", { left: 40, top: mode === "clipped" ? 300 : 400, width: 80, height: 30 });
  target.parentElement = inner;
  const chrome = fakeChrome([target], { trusted: true, owners: [inner, outer] });
  await chrome.driver.press("Yes", 5_000);
  const wheels = chrome.inTarget.filter(entry => entry.method === "Input.dispatchMouseEvent" && entry.params.type === "mouseWheel");
  assert.equal(wheels.length, 1);
  assert.equal(inner.scrollTop, mode === "outer" ? 0 : mode === "inner" ? 130 : 80);
  assert.equal(outer.scrollTop, mode === "outer" ? 180 : 0);
  assert.equal(wheels[0]?.params.y, mode === "inner" ? 200 : mode === "clipped" ? 175 : 150);
  assert.equal(chrome.inTarget.filter(entry => entry.method === "Input.dispatchMouseEvent" && entry.params.type === "mouseReleased").length, 1);
});

for (const kind of ["overlay", "hidden-clip"] as const) test(`a ${kind} is not bypassed by scrolling an unrelated ancestor`, async () => {
  const outer = scroller({ left: 0, top: 0, width: 320, height: 600 });
  const hidden = scroller({ left: 20, top: 100, width: 240, height: 100 }, outer, "hidden");
  const target = button("Yes", { left: 40, top: kind === "hidden-clip" ? 250 : 130, width: 80, height: 30 });
  target.parentElement = hidden;
  const chrome = fakeChrome([target], { trusted: true, owners: [hidden, outer], overlay: kind === "overlay" });
  await assert.rejects(chrome.driver.press("Yes", 50), /covered at its centre/);
  assert.equal(chrome.inTarget.filter(entry => entry.method === "Input.dispatchMouseEvent").length, 0);
});
