// The Stop path while FluxIQ is running something (UI audit, section 4,
// "Stop"): it asks Core through `panelStopRun`, never disconnects, falls back
// to "To stop this, use FluxIQ." when the relay is unsupported or FluxIQ
// refused the token, and every
// failure ends with the run.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelMessage, PanelResult } from "../../state";
import { createRunStop, STOP_WAIT_MS } from "../run-stop";
import { statusWith } from "./status-fixture";

const running = statusWith({ connectionState: "connected", runtime: { state: "running", actionType: "web.dom.click", targetName: "Search" } });
const finished = statusWith({ connectionState: "connected", runtime: { state: "succeeded", actionType: "web.dom.click", finishedAt: 1 } });

function fakeRequest(answer: (message: PanelMessage) => PanelResult<unknown>) {
  const sent: PanelMessage[] = [];
  const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
    sent.push(message);
    return answer(message) as PanelResult<T>;
  };
  return { sent, request };
}

const stopped: PanelResult<unknown> = { ok: true, value: { ok: true, payload: { runtimeSessions: [{ runId: "run-1", status: "cancelled" }] } } };

test("Stop sends panelStopRun and nothing else, then reads Stopping... until the run ends", async () => {
  const { sent, request } = fakeRequest(() => stopped);
  const stop = createRunStop(request, () => 0);
  stop.observe(running, 0);
  assert.deepEqual(stop.view(), { button: { label: "Stop", disabled: false }, fallback: false });

  const pressed = stop.press();
  assert.deepEqual(stop.view().button, { label: "Stopping...", disabled: true }, "disabled while the request is out");
  await pressed;
  assert.equal(sent.some((message) => message.type === RUNTIME_MESSAGES.disconnect), false, "never fakes a stop by disconnecting");
  assert.deepEqual(sent, [{ type: RUNTIME_MESSAGES.panelStopRun }]);
  assert.deepEqual(stop.view().button, { label: "Stopping...", disabled: true });

  assert.equal(stop.observe(finished, 1), true);
  assert.deepEqual(stop.view(), { button: { label: "Stop", disabled: false }, fallback: false }, "ready for the next run");
});

test("unsupported: the button is replaced by the Open FluxIQ fallback, for good", async () => {
  const { sent, request } = fakeRequest(() => ({ ok: false, sentence: "This extension doesn't support that yet.", unsupported: true }));
  const stop = createRunStop(request);
  stop.observe(running, 0);
  await stop.press();
  assert.deepEqual(stop.view(), { fallback: true });
  stop.observe(finished, 1);
  stop.observe(running, 2);
  assert.deepEqual(stop.view(), { fallback: true }, "a later run still falls back");
  await stop.press();
  assert.equal(sent.length, 1, "no second request to a background that does not know the message");
});

test("a failed Stop says so with the way out, keeps Stop pressable, and ends with the run", async () => {
  const { request } = fakeRequest(() => ({ ok: false, sentence: "Something went wrong.", detail: "FluxIQ could not be reached." }));
  const stop = createRunStop(request);
  stop.observe(running, 0);
  await stop.press();
  assert.deepEqual(stop.view(), {
    button: { label: "Stop", disabled: false }, sentence: "Couldn't stop it from here.", detail: "FluxIQ could not be reached.", fallback: true
  });
  assert.equal(stop.observe(running, 1), false, "a status that does not end the run does not wipe the error");
  assert.equal(stop.view().sentence, "Couldn't stop it from here.");
  stop.observe(finished, 2);
  assert.equal(stop.view().sentence, undefined, "the error does not outlive the run");
});

test("Core found nothing to stop", async () => {
  const { request } = fakeRequest(() => ({ ok: true, value: { ok: true, payload: { runtimeSessions: [] } } }));
  const stop = createRunStop(request);
  stop.observe(running, 0);
  await stop.press();
  assert.equal(stop.view().sentence, "FluxIQ didn't find anything to stop.");
  assert.equal(stop.view().fallback, true);
});

test("a step still going long after Stop says FluxIQ hasn't stopped yet", async () => {
  let clock = 0;
  const { request } = fakeRequest(() => stopped);
  const stop = createRunStop(request, () => clock);
  stop.observe(running, 0);
  await stop.press();
  assert.equal(stop.observe(running, STOP_WAIT_MS - 1), false);
  assert.equal(stop.view().button?.label, "Stopping...");
  clock = STOP_WAIT_MS;
  assert.equal(stop.observe(running, STOP_WAIT_MS), true);
  assert.equal(stop.view().sentence, "FluxIQ hasn't stopped yet.");
});

test("a run that ended while Stop was in flight leaves nothing waiting", async () => {
  let release: (() => void) | undefined;
  const request = async <T>(): Promise<PanelResult<T>> => {
    await new Promise<void>((resolve) => (release = resolve));
    return stopped as PanelResult<T>;
  };
  const stop = createRunStop(request);
  stop.observe(running, 0);
  const pressed = stop.press();
  stop.observe(finished, 1);
  release?.();
  await pressed;
  assert.deepEqual(stop.view(), { button: { label: "Stop", disabled: false }, fallback: false });
});

test("a refused token: no pointless Stop, the sentence and Open FluxIQ, until the run ends", async () => {
  const { sent, request } = fakeRequest(() => ({ ok: false, sentence: "FluxIQ didn't accept this browser.", detail: "401 Unauthorized", code: "refused" }));
  const stop = createRunStop(request);
  stop.observe(running, 0);
  await stop.press();
  assert.deepEqual(stop.view(), { sentence: "FluxIQ didn't let this browser stop it.", detail: "401 Unauthorized", fallback: true });
  await stop.press();
  assert.equal(sent.length, 1, "pressing again cannot help, so nothing more is sent");
  stop.observe(finished, 1);
  assert.deepEqual(stop.view(), { button: { label: "Stop", disabled: false }, fallback: false }, "the next run starts with Stop again");
});

test("any other relay code is an ordinary failure that keeps Stop pressable", async () => {
  const { request } = fakeRequest(() => ({ ok: false, sentence: "Can't reach FluxIQ.", detail: "fetch failed", code: "unreachable" }));
  const stop = createRunStop(request);
  stop.observe(running, 0);
  await stop.press();
  assert.equal(stop.view().sentence, "Couldn't stop it from here.");
  assert.deepEqual(stop.view().button, { label: "Stop", disabled: false });
});
