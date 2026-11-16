// The getting-started steps for every connection state: which step is done,
// which is next, what the connect button says, and when the chat comes back.

import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionStatus } from "../../../../shared/protocol";
import { statusWith } from "../../../tests/status-fixture";
import { startGuide, type StartGuide } from "../steps";

const states = (guide: StartGuide) => guide.steps.map((step) => `${step.key}:${step.state}`);

test("disconnected and never approved: every step in order, nothing ticked, Connect is the button", () => {
  const guide = startGuide(statusWith(), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["start:current", "signin:todo", "connect:todo", "approve:todo", "key:todo"]);
  assert.deepEqual(guide.connect, { label: "Connect", action: "connect" });
  assert.equal(guide.pairingCode, undefined);
  assert.equal(guide.steps[2]?.line, "Press Connect so FluxIQ can work in this browser.");
  assert.equal(guide.card, false);
  assert.doesNotMatch(guide.line, /three/iu, "the heading line no longer says three steps");
});

test("step one says how FluxIQ starts, in words; step two says to sign in", () => {
  const guide = startGuide(statusWith(), false);
  assert.match(guide.steps[0]?.line ?? "", /running on this computer/u);
  assert.doesNotMatch(guide.steps[0]?.line ?? "", /pnpm|folder|!FluxIQ/u, "the first step names no command or folder");
  assert.match(guide.steps[1]?.line ?? "", /sign in/iu);
  for (const state of ["disconnected", "connecting", "reconnecting", "pairing", "error"] as const) {
    for (const item of startGuide(statusWith({ connectionState: state }), false).steps) {
      assert.doesNotMatch(`${item.title} ${item.line ?? ""}`, /ws:|wss:|127\.0\.0\.1|localhost/u, `${state}/${item.key}: no address in the words`);
    }
  }
});

test("disconnected but approved before: signing in and approval stay done, the rest is still to do", () => {
  const guide = startGuide(statusWith({ paired: true }), false);
  assert.deepEqual(states(guide), ["start:current", "signin:done", "connect:todo", "approve:done", "key:todo"]);
  assert.equal(guide.steps[2]?.line, "Connect to pick up where you left off.");
});

test("connecting and reconnecting: the connect step is under way, with Cancel or Try now", () => {
  const connecting = startGuide(statusWith({ connectionState: "connecting" }), false);
  assert.deepEqual(states(connecting), ["start:current", "signin:todo", "connect:waiting", "approve:todo", "key:todo"]);
  assert.deepEqual(connecting.connect, { label: "Cancel", action: "disconnect" });
  const reconnecting = startGuide(statusWith({ connectionState: "reconnecting", paired: true }), false);
  assert.deepEqual(states(reconnecting), ["start:current", "signin:done", "connect:waiting", "approve:done", "key:todo"]);
  assert.deepEqual(reconnecting.connect, { label: "Try now", action: "connect" });
});

test("pairing: FluxIQ is reached and connected, approval is under way with the code", () => {
  const guide = startGuide(statusWith({ connectionState: "pairing", pairingReferenceCode: "482913" }), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["start:done", "signin:waiting", "connect:done", "approve:waiting", "key:todo"]);
  assert.equal(guide.pairingCode, "482913");
  assert.equal(guide.connect, undefined, "no Connect while waiting for approval");
  assert.equal(startGuide(statusWith({ connectionState: "pairing" }), false).pairingCode, "------", "a code not yet sent shows as dashes");
});

test("connected, key not read: the chat comes back, steps one to four are done and nothing is said of the key", () => {
  const guide = startGuide(statusWith({ connectionState: "connected", paired: true }), false);
  assert.equal(guide.gated, false);
  assert.deepEqual(states(guide), ["start:done", "signin:done", "connect:done", "approve:done"]);
  assert.equal(guide.card, false);
});

test("connected with the key configured: five ticks and no card", () => {
  const guide = startGuide(statusWith({ connectionState: "connected", paired: true }), false, undefined, "ready");
  assert.deepEqual(states(guide), ["start:done", "signin:done", "connect:done", "approve:done", "key:done"]);
  assert.equal(guide.card, false);
  assert.equal(guide.steps.at(-1)?.title, "Model key configured");
});

test("connected with no key: the key step is the one to do, the card shows, the chat is not gated", () => {
  const guide = startGuide(statusWith({ connectionState: "connected", paired: true }), false, undefined, "missing");
  assert.equal(guide.gated, false);
  assert.deepEqual(states(guide), ["start:done", "signin:done", "connect:done", "approve:done", "key:current"]);
  assert.equal(guide.card, true);
  assert.match(guide.steps.at(-1)?.line ?? "", /open FluxIQ/u);
  assert.match(guide.steps.at(-1)?.line ?? "", /Saved Flows.*can still run/u);
});

test("unavailable configuration never creates a sixth step or gates connected work", () => {
  for (const code of ["legacy_recovery_required", "host_protection_unavailable", "ciphertext_invalid"] as const) {
    const guide = startGuide(statusWith({ connectionState: "connected", paired: true }), false, undefined, { state: "unavailable", code });
    assert.equal(guide.gated, false);
    assert.deepEqual(states(guide), ["start:done", "signin:done", "connect:done", "approve:done", "key:problem"]);
    assert.equal(guide.card, true);
    assert.equal(guide.steps.at(-1)?.title, "Model key unavailable");
    assert.doesNotMatch(JSON.stringify(guide), /unlock|password/iu);
  }
});

test("legacy incompatibility offers an upgrade, leaving the connection usable", () => {
  const guide = startGuide(statusWith({ connectionState: "connected", paired: true }), false, undefined, "upgrade_required");
  assert.equal(guide.gated, false);
  assert.equal(guide.steps.length, 5);
  assert.match(guide.steps.at(-1)?.line ?? "", /Update FluxIQ/u);
  assert.doesNotMatch(JSON.stringify(guide), /unlock|password/iu);
});

test("model availability never changes the independent connection steps", () => {
  for (const state of ["disconnected", "connecting", "reconnecting", "pairing", "error"] as const) {
    const guide = startGuide(statusWith({ connectionState: state }), false, undefined, { state: "unavailable", code: "ciphertext_invalid" });
    assert.equal(guide.steps.length, 5, state);
    assert.deepEqual(guide, startGuide(statusWith({ connectionState: state }), false, undefined, "missing"));
    assert.equal(guide.steps.find((item) => item.key === "key")?.state, "todo", state);
    assert.equal(guide.card, false, state);
  }
});

test("no tick on anything not detected: before connecting only a stored approval ticks", () => {
  for (const state of ["disconnected", "connecting", "reconnecting", "error"] as const) {
    const done = startGuide(statusWith({ connectionState: state }), false).steps.filter((item) => item.state === "done");
    assert.deepEqual(done, [], state);
  }
});

test("FluxIQ unreachable: the first step is the problem, in words, with Try again and a way to the address", () => {
  const guide = startGuide(statusWith({ connectionState: "error" }), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["start:problem", "signin:todo", "connect:todo", "approve:todo", "key:todo"]);
  assert.deepEqual(guide.connect, { label: "Try again", action: "connect" });
  assert.equal(guide.addressLink, true);
  assert.match(guide.steps[0]?.line ?? "", /isn't answering/u);
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

test("the sign-in step never prints a default credential", () => {
  for (const state of ["disconnected", "pairing"] as const) {
    const line = startGuide(statusWith({ connectionState: state }), false).steps.find((item) => item.key === "signin")?.line ?? "";
    assert.doesNotMatch(line, /admin|password/iu, state);
    assert.match(line, /sign in/iu, state);
  }
});

test("FluxIQ answers before pairing: Start FluxIQ is done and Sign in is the next step", () => {
  const guide = startGuide(statusWith(), false, undefined, "unknown", true);
  assert.deepEqual(states(guide), ["start:done", "signin:current", "connect:todo", "approve:todo", "key:todo"]);
  assert.equal(guide.steps[0]?.title, "FluxIQ is running");
});

test("FluxIQ answers and the browser was approved before: Start is done, Sign in stays done, Connect is the button", () => {
  const guide = startGuide(statusWith({ paired: true }), false, undefined, "unknown", true);
  assert.deepEqual(states(guide).slice(0, 3), ["start:done", "signin:done", "connect:todo"]);
});

test("FluxIQ not answering or not asked: Start FluxIQ stays the next step", () => {
  assert.equal(startGuide(statusWith(), false, undefined, "unknown", false).steps[0]?.state, "current");
  assert.equal(startGuide(statusWith(), false).steps[0]?.state, "current");
});
