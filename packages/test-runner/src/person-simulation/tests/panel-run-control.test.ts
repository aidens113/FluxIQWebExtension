import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { extensionViewPanelRunControlSurface, pagePanelRunControlSurface, panelRunControlLog, pressPanelRunControl, type PanelRunControlPress } from "../panel-run-control.js";
import { virtualClock } from "./fake-person.js";

type FakeButton = { name: string; visible: boolean; enabled: boolean; clicks: number };

/** A panel page by role and exact name, with the chat's live step; every click is recorded. */
function fakePage(buttons: FakeButton[], live: { step: string | null } = { step: null }): { page: Page; clicked: string[]; roleQueries: Array<{ name: string; exact: boolean }> } {
  const clicked: string[] = [];
  const roleQueries: Array<{ name: string; exact: boolean }> = [];
  const page = {
    getByRole(role: string, options: { name: string; exact: boolean }) {
      assert.equal(role, "button");
      roleQueries.push(options);
      const matching = () => buttons.filter((button) => button.name === options.name);
      return {
        count: async () => matching().length,
        nth: (index: number) => ({
          isVisible: async () => matching()[index]!.visible,
          isEnabled: async () => matching()[index]!.enabled,
          click: async () => { const button = matching()[index]!; button.clicks += 1; clicked.push(button.name); },
        }),
      };
    },
    locator(selector: string) {
      assert.equal(selector, ".chat-live-step");
      const first = { count: async () => (live.step === null ? 0 : 1), isVisible: async () => live.step !== null, textContent: async () => live.step };
      return { first: () => first };
    },
  } as unknown as Page;
  return { page, clicked, roleQueries };
}

const button = (name: string, visible = true, enabled = true): FakeButton => ({ name, visible, enabled, clicks: 0 });

test("presses the control by its exact name and says what was pressed and when", async () => {
  const clock = virtualClock();
  const { page, clicked, roleQueries } = fakePage([button("Take over"), button("Stop run")]);
  const published: PanelRunControlPress[] = [];
  const press = await pressPanelRunControl({ surface: pagePanelRunControlSurface(page), control: "takeOver", now: clock.now, sleep: clock.sleep, publish: async (value) => { published.push(value); } });
  assert.deepEqual(clicked, ["Take over"]);
  assert.ok(roleQueries.every((query) => query.exact));
  assert.equal(press.pressed, true);
  assert.equal(press.name, "Take over");
  assert.equal(press.refusal, null);
  assert.equal(press.attempts, 1);
  assert.equal(press.pressedAt, new Date(0).toISOString());
  assert.deepEqual(published, [press]);
});

test("stop presses whichever name the work gives it: Stop build for a build", async () => {
  const clock = virtualClock();
  const { page, clicked } = fakePage([button("Stop build"), button("Hand back")]);
  const press = await pressPanelRunControl({ surface: pagePanelRunControlSurface(page), control: "stop", now: clock.now, sleep: clock.sleep });
  assert.deepEqual(clicked, ["Stop build"]);
  assert.equal(press.name, "Stop build");
});

test("waits for the button to show, then presses it", async () => {
  const clock = virtualClock();
  const handBack = button("Hand back", false);
  const { page, clicked } = fakePage([handBack]);
  clock.onTick((at) => { if (at >= 1_000) handBack.visible = true; });
  const press = await pressPanelRunControl({ surface: pagePanelRunControlSurface(page), control: "handBack", now: clock.now, sleep: clock.sleep });
  assert.deepEqual(clicked, ["Hand back"]);
  assert.equal(press.pressed, true);
  assert.equal(press.secondsWaited, 1);
});

test("refuses, without throwing, when the control never shows: first attempt plus 3 retries", async () => {
  const clock = virtualClock();
  const { page, clicked } = fakePage([button("Stop run", false)]);
  const press = await pressPanelRunControl({ surface: pagePanelRunControlSurface(page), control: "stop", now: clock.now, sleep: clock.sleep, attemptWaitMs: 1_000 });
  assert.deepEqual(clicked, []);
  assert.equal(press.pressed, false);
  assert.equal(press.refusal, "not-shown");
  assert.equal(press.attempts, 4);
  assert.equal(press.pressedAt, null);
  assert.match(press.note ?? "", /no Stop run \/ Stop build \/ Stop button/);
});

test("refuses when the control stays disabled, and never presses it", async () => {
  const clock = virtualClock();
  const { page, clicked } = fakePage([button("Take over", true, false)]);
  const press = await pressPanelRunControl({ surface: pagePanelRunControlSurface(page), control: "takeOver", now: clock.now, sleep: clock.sleep, attemptWaitMs: 500 });
  assert.deepEqual(clicked, []);
  assert.equal(press.refusal, "disabled");
});

test("waits for the live line to show step N before pressing", async () => {
  const clock = virtualClock();
  const live = { step: "Step 1 of 4: Open the store" as string | null };
  const { page, clicked } = fakePage([button("Stop run")], live);
  clock.onTick((at) => { if (at >= 2_000) live.step = "Step 2 of 4: Search"; });
  const press = await pressPanelRunControl({ surface: pagePanelRunControlSurface(page), control: "stop", atStep: 2, now: clock.now, sleep: clock.sleep });
  assert.deepEqual(clicked, ["Stop run"]);
  assert.equal(press.atStep, 2);
  assert.equal(press.stepSeen, 2);
  assert.ok(clock.at() >= 2_000);
});

test("refuses when the step never comes, before touching the control", async () => {
  const clock = virtualClock();
  const { page, clicked } = fakePage([button("Stop run")], { step: "Step 1" });
  const press = await pressPanelRunControl({ surface: pagePanelRunControlSurface(page), control: "stop", atStep: 3, stepWaitMs: 3_000, now: clock.now, sleep: clock.sleep });
  assert.deepEqual(clicked, []);
  assert.equal(press.refusal, "step-not-reached");
  assert.equal(press.attempts, 0);
  assert.equal(press.stepSeen, 1);
});

test("honours the caller's predicate when the live line shows no step", async () => {
  const clock = virtualClock();
  let readyNow = false;
  const { page, clicked } = fakePage([button("Take over")]);
  clock.onTick((at) => { if (at >= 750) readyNow = true; });
  const press = await pressPanelRunControl({ surface: pagePanelRunControlSurface(page), control: "takeOver", when: async () => readyNow, now: clock.now, sleep: clock.sleep });
  assert.deepEqual(clicked, ["Take over"]);
  assert.ok(clock.at() >= 750);
  assert.equal(press.atStep, null);
});

test("a panel that cannot be read and a failed publish are words in the record, not raw errors", async () => {
  const clock = virtualClock();
  const surface = { find: async () => { throw new Error("Target page, context or browser has been closed\n  at <button>page markup</button>"); }, press: async () => false, liveStep: async () => null };
  const press = await pressPanelRunControl({ surface, control: "handBack", now: clock.now, sleep: clock.sleep, attemptWaitMs: 300, publish: async () => { throw new Error("timeline down"); } });
  assert.equal(press.refusal, "panel-unreadable");
  assert.match(press.note ?? "", /has been closed/);
  assert.doesNotMatch(press.note ?? "", /markup/);
  assert.match(press.note ?? "", /publishing the press failed: timeline down/);
});

test("the log keeps every press for the bundle", async () => {
  const clock = virtualClock();
  const log = panelRunControlLog();
  const { page } = fakePage([button("Hand back")]);
  log.add(await pressPanelRunControl({ surface: pagePanelRunControlSurface(page), control: "handBack", now: clock.now, sleep: clock.sleep }));
  assert.equal(log.snapshot().presses.length, 1);
  assert.equal(log.snapshot().presses[0]!.name, "Hand back");
});

test("Chrome's side panel is pressed through the extension's views by exact name, skipping disabled and hidden buttons", async () => {
  const clicks: string[] = [];
  const make = (text: string, disabled: boolean, visible = true) => ({ textContent: text, disabled, getAttribute: () => null, checkVisibility: () => visible, click: () => { clicks.push(text); } });
  const panel = { location: { pathname: "/sidepanel/index.html" }, document: {
    querySelectorAll: () => [make("Stop run", true), make("Stop run", false, false), make("Stop", false), make("Take over", false)],
    querySelector: () => ({ textContent: "Step 3 of 5", checkVisibility: () => true, getClientRects: () => [1] }),
  } };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { extension: { getViews: () => [panel] } } });
  try {
    const control = { evaluate: async (fn: (value: unknown) => unknown, value: unknown) => fn(value) } as unknown as Page;
    const surface = extensionViewPanelRunControlSurface(control, "sidepanel/index.html");
    assert.deepEqual(await surface.find(["Stop run", "Stop build", "Stop"]), { name: "Stop", enabled: true });
    assert.equal(await surface.liveStep(), 3);
    assert.equal(await surface.press("Stop run"), false);
    assert.equal(await surface.press("Take over"), true);
    assert.deepEqual(clicks, ["Take over"]);
    await assert.rejects(extensionViewPanelRunControlSurface(control, "popup/index.html").find(["Stop"]), /no panel view/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome");
  }
});
