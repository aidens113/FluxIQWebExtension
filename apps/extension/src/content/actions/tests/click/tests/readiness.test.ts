import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { setImmediate } from "node:timers/promises";
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import { watchIgnoredPress } from "../../../../action-runtime/ignored-press";
import { webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { PressSignal } from "../../../../action-runtime";
import { clickAction } from "../../../click";
import { CLICK, dependencies, fakeCheckWatch, fakeIgnoredWatch, fakeNoticeWatch, fakePage, fakeWatch, installMouseEvent } from "..";

/** Real ignored-press observation and click policy, with a page's pending work and answers driven explicitly. */
function page(t: TestContext, onPress: (count: number, emit: (signal: PressSignal) => void) => void) {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 0 });
  installMouseEvent(t);
  const p = fakePage({ link: false, prevent: false });
  const deps = dependencies(p.element, fakeWatch(undefined, p.events).make, fakeNoticeWatch(undefined, p.events), fakeCheckWatch(undefined, p.events), fakeIgnoredWatch([], p.events), true);
  const state = { pending: true, presses: 0, stopped: 0 };
  let note: (signal: PressSignal) => void = () => undefined;
  const emit = (signal: PressSignal) => note(signal);
  deps.watchPressReadiness = () => ({ pending: () => state.pending });
  deps.watchIgnoredPress = pressed => watchIgnoredPress(pressed, (_target, onSignal) => {
    note = onSignal;
    return { flush: () => undefined, stop: () => { state.stopped += 1; } };
  }, () => ({ settle: async () => false, stop: () => undefined }));
  deps.timedOut = (action, startedAt, message, validation) => ({
    commandId: action.commandId, actionType: action.actionType, startedAt, finishedAt: Date.now(), status: "timed_out", message, validation,
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT)
  });
  const dispatch = p.element.dispatchEvent;
  p.element.dispatchEvent = event => {
    const accepted = dispatch.call(p.element, event);
    if (event.type === "click") onPress(++state.presses, emit);
    return accepted;
  };
  return { deps, state, emit };
}

test("late binding preserves the immediate first press and admits only its existing extra press", async t => {
  const p = page(t, (count, emit) => { if (count === 2) emit("request"); });
  let finished = false;
  const result = clickAction({ ...CLICK, timeoutMs: 5_000 }, p.deps, 0).then(value => { finished = true;
    return value; });
  assert.equal(p.state.presses, 1, "there is no unconditional pre-press wait");
  t.mock.timers.tick(800);
  await setImmediate();
  assert.equal(finished, false);
  assert.equal(p.state.presses, 1, "the extra press must not be spent on an unbound control");
  assert.equal(p.state.stopped, 0, "the original answer watch stays alive throughout readiness");
  // The target binds while other one-shot work is still scheduled. Its readiness
  // watch stops pending on that binding, independently of the other work.
  p.state.pending = false;
  t.mock.timers.tick(50);
  const answer = await result;
  assert.equal(answer.status, "succeeded");
  assert.equal(p.state.presses, 2);
  assert.ok(answer.validation.status !== "none");
  assert.match(String(answer.validation.actual), /pressed once more/u);
});

test("a delayed lasting request from the first press ends readiness without any duplicate press", async t => {
  const p = page(t, () => undefined);
  const result = clickAction({ ...CLICK, timeoutMs: 5_000 }, p.deps, 0);
  t.mock.timers.tick(800);
  await setImmediate();
  assert.equal(p.state.presses, 1);
  p.emit("request");
  const answer = await result;
  assert.equal(answer.status, "succeeded");
  assert.equal(p.state.presses, 1);
  assert.equal(p.state.stopped, 1);
  assert.ok(answer.validation.status !== "none");
  assert.doesNotMatch(String(answer.validation.actual), /pressed once more/u);
});

test("native, inline, and globally delegated actions that answer the first press never wait for unrelated work", async t => {
  const p = page(t, (_count, emit) => emit("change"));
  const result = await clickAction({ ...CLICK, timeoutMs: 5_000 }, p.deps, 0);
  assert.equal(result.status, "succeeded");
  assert.equal(Date.now(), 0);
  assert.equal(p.state.presses, 1);
  assert.equal(p.state.pending, true);
});

test("the command's deadline ends pending readiness without an extra press or a certain-no-effect claim", async t => {
  const p = page(t, () => undefined);
  const result = clickAction({ ...CLICK, timeoutMs: 1_000 }, p.deps, 0);
  t.mock.timers.tick(800);
  await setImmediate();
  assert.equal(p.state.presses, 1);
  t.mock.timers.tick(200);
  const answer = await result;
  assert.equal(answer.status, "timed_out");
  assert.equal(answer.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT);
  assert.equal(answer.failure?.effect, undefined, "unknown lasting effects remain unknown");
  assert.equal(p.state.presses, 1);
  assert.equal(p.state.stopped, 1);
});
