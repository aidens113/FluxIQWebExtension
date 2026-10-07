import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActivity } from "../../../shared/activity";
import type { PanelMessage } from "../../state";
import { createStopControl } from "../stop-control";
import { fake, withFakeDocument } from "./fake-dom";

const activity = (kind: "build" | "run", id = "work"): ClientGatewayActivity => ({ activityId: `${kind}:${id}`, sequence: 1,
  subject: { kind, id, projectId: "p", flowId: "f" }, phase: "building", label: "Working", at: "2026-10-06T00:00:00Z" });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test("Stop targets build Flow and run ID, waits for final activity and prevents duplicate clicks", async () => {
  await withFakeDocument(async () => {
    const sent: PanelMessage[] = [];
    const control = createStopControl(async message => { sent.push(message); return { ok: true, value: { ok: true } as never }; }, () => true);
    const button = fake(control.element).byClass("chat-stop")[0]!;
    control.update(activity("build"));
    assert.equal(control.element.hidden, false);
    assert.equal(button.textContent, "Stop build");
    button.dispatch("click"); button.dispatch("click"); await settle();
    assert.deepEqual(sent, [{ type: "fluxiq.panel.stopRun", projectId: "p", flowId: "f" }]);
    assert.equal(button.disabled, true);
    assert.match(fake(control.element).textContent, /Waiting for the work/);
    control.update({ ...activity("build"), final: true, phase: "failed" });
    assert.equal(control.element.hidden, true);
    control.update(activity("run", "r")); button.dispatch("click"); await settle();
    assert.deepEqual(sent[1], { type: "fluxiq.panel.stopRun", projectId: "p", runId: "r" });
  });
});

test("disconnected ownership and terminal activity cannot Stop; a failed Stop is retryable", async () => {
  await withFakeDocument(async () => {
    let eligible = true, calls = 0;
    const control = createStopControl(async () => { calls++; return { ok: true, value: { ok: false } as never }; }, () => eligible);
    const button = fake(control.element).byClass("chat-stop")[0]!;
    control.update(activity("build")); eligible = false; button.dispatch("click"); assert.equal(calls, 0);
    eligible = true; button.dispatch("click"); await settle();
    assert.equal(button.disabled, false);
    assert.match(fake(control.element).textContent, /Couldn't stop/);
    control.update({ ...activity("build"), final: true }); button.dispatch("click"); assert.equal(calls, 1);
  });
});
