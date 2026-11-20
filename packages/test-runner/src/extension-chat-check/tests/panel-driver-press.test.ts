import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import type { CDPSession, Page } from "@playwright/test";
import { extensionViewPanelDriver } from "../panel-driver.js";

const PANEL_URL = "chrome-extension://abcdefgh/sidepanel/index.html";
/** The side panel's view, in CSS pixels: the height the live run's Continue was centred in (F16, y 369). */
const VIEW = { width: 400, height: 738 };

type Box = { left: number; top: number; width: number; height: number };
type Overflow = { overflowX: string; overflowY: string };
/** The chat's scroller: what clips the buttons inside it. */
type FakeScroller = { style: Overflow; parentElement: null; getBoundingClientRect(): Box & { right: number; bottom: number } };
type FakeButton = { textContent: string; disabled: boolean; tagName: string; box: Box; scrolled: number; parentElement: FakeScroller | null; getClientRects(): unknown[]; getBoundingClientRect(): Box; scrollIntoView(): void; contains(node: unknown): boolean };
type Sent = { method: string; params: Record<string, unknown> };

function button(label: string, box: Box, disabled = false, parentElement: FakeScroller | null = null): FakeButton {
  const made: FakeButton = {
    textContent: ` ${label} `,
    disabled,
    tagName: "BUTTON",
    box,
    scrolled: 0,
    parentElement,
    getClientRects: () => [made.box],
    getBoundingClientRect: () => made.box,
    // A script's scroll: in a chat that scrolls, the button to the middle of the view.
    scrollIntoView: () => {
      made.scrolled += 1;
      if (made.parentElement) made.box = { ...made.box, top: VIEW.height / 2 - made.box.height / 2 };
    },
    contains: node => node === made,
  };
  return made;
}

/** The chat's scroller, filling the view and clipping what overflows it. */
function scroller(): FakeScroller {
  return { style: { overflowX: "hidden", overflowY: "auto" }, parentElement: null, getBoundingClientRect: () => ({ left: 0, top: 0, right: VIEW.width, bottom: VIEW.height, width: VIEW.width, height: VIEW.height }) };
}

/**
 * The side panel's document as a vm context, so the press script runs as
 * Chrome would run it (`Runtime.evaluate` of its source text), and a CDP
 * session that answers like Chrome's for the control tab and the side panel
 * target: a released mouse button over a button clicks it with `isTrusted`
 * as given and grants the view activation, and a turn of the wheel scrolls
 * every button by its distance.
 *
 * `follows` plays the chat's scroll follower (Core's
 * `chat/view/scroll-follower.ts`): a scroll that is not the person's is put
 * back on the chat's next frame, which comes before the target handles the
 * next command; a wheel turn is the person's and stays.
 */
function fakeChrome(buttons: FakeButton[], input: { trusted?: boolean; follows?: boolean } = {}) {
  const trusted = input.trusted ?? true;
  const listeners = new Set<(event: unknown) => void>();
  const activation = { isActive: false };
  const inside = (box: Box, x: number, y: number) => x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
  const pinned = new Map(buttons.map(candidate => [candidate, candidate.box]));
  const panel = vm.createContext({
    document: {
      querySelectorAll: (selector: string) => selector === "button" ? buttons : [],
      elementFromPoint: (x: number, y: number) => buttons.find(candidate => inside(candidate.box, x, y)) ?? null,
    },
    innerWidth: VIEW.width,
    innerHeight: VIEW.height,
    getComputedStyle: (node: { style?: Overflow }) => node.style ?? { overflowX: "visible", overflowY: "visible" },
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
    if (input.follows) for (const candidate of buttons) candidate.box = pinned.get(candidate)!;
    inTarget.push({ method, params });
    if (method === "Runtime.evaluate") {
      const value = vm.runInContext(String(params.expression), panel);
      return reply({ id, result: { result: { type: "object", value: JSON.parse(JSON.stringify(value)) } } });
    }
    if (method === "Input.dispatchMouseEvent" && params.type === "mouseWheel") {
      for (const candidate of buttons) {
        candidate.box = { ...candidate.box, left: candidate.box.left - Number(params.deltaX), top: candidate.box.top - Number(params.deltaY) };
        pinned.set(candidate, candidate.box);
      }
    }
    if (method === "Input.dispatchMouseEvent" && params.type === "mousePressed") activation.isActive = true;
    if (method === "Input.dispatchMouseEvent" && params.type === "mouseReleased") {
      const target = buttons.find(candidate => inside(candidate.box, Number(params.x), Number(params.y)));
      if (target) for (const listener of [...listeners]) listener({ isTrusted: trusted, target });
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

const mouse = (chrome: { inTarget: Sent[] }) => chrome.inTarget.filter(entry => entry.method === "Input.dispatchMouseEvent").map(entry => entry.params);

test("a side-panel press attaches to the panel's own target, finds the button, and releases the left mouse button at its centre", async () => {
  const chrome = fakeChrome([button("No", { left: 10, top: 200, width: 60, height: 30 }), button("Yes", { left: 100, top: 200, width: 80, height: 30 })]);
  await chrome.driver.press("Yes", 1_000);
  const flow = chrome.sent.map(entry => entry.method === "Target.sendMessageToTarget" ? JSON.parse(String(entry.params.message)).method : entry.method);
  assert.deepEqual(flow.slice(0, 7), ["Target.getTargetInfo", "Target.getTargets", "Target.attachToTarget", "Runtime.evaluate", "Input.dispatchMouseEvent", "Input.dispatchMouseEvent", "Input.dispatchMouseEvent"]);
  assert.deepEqual(chrome.sent.find(entry => entry.method === "Target.attachToTarget")?.params, { targetId: "side-panel", flatten: false });
  assert.deepEqual(mouse(chrome), [
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

// F16 (run-mwokogky-ec1e6cfc): the chat follows its newest content and puts back any scroll that is not the person's.
// A press that scrolled the button to the middle by script hit-tested it there, and the mouse then landed where the
// chat had scrolled back to, so the answer never reached FluxIQ. Without the fix both tests below fail with the live
// run's own words: the press at (59, 369) did not reach the "Continue" button.
test("a button showing above the middle of a chat that follows its newest content is pressed where it stands, without scrolling the chat", async () => {
  const chat = scroller();
  const shown = button("Continue", { left: 19, top: 120, width: 80, height: 30 }, false, chat);
  const chrome = fakeChrome([button("Stop", { left: 110, top: 120, width: 80, height: 30 }, false, chat), shown], { follows: true });
  await chrome.driver.press("Continue", 2_000);
  assert.equal(shown.scrolled, 0, "the press never scrolls the chat by script");
  assert.deepEqual(mouse(chrome).map(event => [event.type, event.x, event.y]), [["mouseMoved", 59, 135], ["mousePressed", 59, 135], ["mouseReleased", 59, 135]]);
});

test("a button scrolled out of the chat's view is brought into it by a turn of the wheel over the chat, then pressed", async () => {
  const chat = scroller();
  const away = button("Continue", { left: 19, top: 900, width: 80, height: 30 }, false, chat);
  const chrome = fakeChrome([away], { follows: true });
  await chrome.driver.press("Continue", 3_000);
  assert.equal(away.scrolled, 0, "the press never scrolls the chat by script");
  assert.deepEqual(mouse(chrome), [
    { type: "mouseWheel", x: 200, y: 369, deltaX: 0, deltaY: 546, button: "none", buttons: 0 },
    { type: "mouseMoved", x: 59, y: 369, button: "none", buttons: 0, clickCount: 0 },
    { type: "mousePressed", x: 59, y: 369, button: "left", buttons: 1, clickCount: 1 },
    { type: "mouseReleased", x: 59, y: 369, button: "left", buttons: 0, clickCount: 1 },
  ]);
});
