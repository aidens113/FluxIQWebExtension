// The getting-started steps for every connection state: which step is done,
// which is next, what the connect button says, and when the chat comes back.

import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionStatus } from "../../../shared/protocol";
import { statusWith } from "../../tests/status-fixture";
import { startGuide, type StartGuide } from "../start-steps";

const states = (guide: StartGuide) => guide.steps.map((step) => `${step.key}:${step.state}`);

test("disconnected and never approved: all three steps, Connect is the button", () => {
  const guide = startGuide(statusWith(), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["open:current", "connect:todo", "approve:todo"]);
  assert.deepEqual(guide.connect, { label: "Connect", action: "connect" });
  assert.equal(guide.pairingCode, undefined);
  assert.equal(guide.steps[1]?.line, "Connect this browser so FluxIQ can work in it.");
});

test("disconnected but approved before: the approval step stays done", () => {
  const guide = startGuide(statusWith({ paired: true }), false);
  assert.deepEqual(states(guide), ["open:current", "connect:todo", "approve:done"]);
  assert.equal(guide.steps[1]?.line, "Connect to pick up where you left off.");
});

test("connecting and reconnecting: the connect step is under way, with Cancel or Try now", () => {
  const connecting = startGuide(statusWith({ connectionState: "connecting" }), false);
  assert.deepEqual(states(connecting), ["open:current", "connect:waiting", "approve:todo"]);
  assert.deepEqual(connecting.connect, { label: "Cancel", action: "disconnect" });
  const reconnecting = startGuide(statusWith({ connectionState: "reconnecting", paired: true }), false);
  assert.deepEqual(states(reconnecting), ["open:current", "connect:waiting", "approve:done"]);
  assert.deepEqual(reconnecting.connect, { label: "Try now", action: "connect" });
});

test("pairing: FluxIQ is reached and connected, approval is under way with the code", () => {
  const guide = startGuide(statusWith({ connectionState: "pairing", pairingReferenceCode: "482913" }), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["open:done", "connect:done", "approve:waiting"]);
  assert.equal(guide.pairingCode, "482913");
  assert.equal(guide.connect, undefined, "no Connect while waiting for approval");
  assert.equal(startGuide(statusWith({ connectionState: "pairing" }), false).pairingCode, "------", "a code not yet sent shows as dashes");
});

test("paired and connected: the chat comes back and every step is done", () => {
  const guide = startGuide(statusWith({ connectionState: "connected", paired: true }), false);
  assert.equal(guide.gated, false);
  assert.deepEqual(states(guide), ["open:done", "connect:done", "approve:done"]);
});

test("U5: while FluxIQ builds, nothing says a setup step is still to do, and no step is about an AI model key", () => {
  // The old Simple Mode checklist said "Add an AI model key: To do" beside a working live build, from a
  // secret-keys snapshot that did not list the key the build was using. A build that is running proves
  // the model works, so the panel no longer reports on the key at all.
  for (const runtime of [undefined, { state: "running" as const }, { state: "idle" as const }]) {
    const guide = startGuide(statusWith({ connectionState: "connected", paired: true, runtime }), false);
    assert.equal(guide.gated, false, "the chat, not the guide, shows while connected");
    assert.deepEqual(guide.steps.filter((step) => step.state !== "done"), []);
  }
  for (const state of ["disconnected", "connecting", "reconnecting", "pairing", "error", "connected"] as const) {
    const guide = startGuide(statusWith({ connectionState: state }), false);
    assert.deepEqual(guide.steps.map((step) => step.key).filter((key) => !["open", "connect", "approve"].includes(key)), []);
    assert.ok(guide.steps.every((step) => !/model|key/iu.test(`${step.title} ${step.line ?? ""}`)), `${state}: no step mentions a model key`);
  }
});

test("FluxIQ unreachable: the first step is the problem, Try again, and a way to the address", () => {
  const guide = startGuide(statusWith({ connectionState: "error" }), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["open:problem", "connect:todo", "approve:todo"]);
  assert.deepEqual(guide.connect, { label: "Try again", action: "connect" });
  assert.equal(guide.addressLink, true);
});

test("critical: the background never answered, so there are no steps, only what to do", () => {
  const guide = startGuide(undefined, true);
  assert.equal(guide.gated, true);
  assert.equal(guide.heading, "The extension isn't answering");
  assert.deepEqual(guide.steps, []);
  assert.equal(guide.connect, undefined);
});

test("before the first status: a checking line, no steps, and the chat not yet shown", () => {
  const guide = startGuide(undefined, false);
  assert.equal(guide.gated, true);
  assert.equal(guide.line, "Checking the connection...");
  assert.deepEqual(guide.steps, []);
});

test("the Lab's connect button names: exactly one of Connect, Try again, Try now whenever the connection is idle or failed", () => {
  const idle: ExtensionStatus["connectionState"][] = ["disconnected", "error", "reconnecting"];
  for (const connectionState of idle) {
    assert.match(startGuide(statusWith({ connectionState }), false).connect?.label ?? "", /^(Connect|Try again|Try now)$/u, connectionState);
  }
});
