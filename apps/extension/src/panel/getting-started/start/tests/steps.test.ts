// The getting-started steps for every connection state: which step is done,
// which is next, what the connect button says, and when the chat comes back.

import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionStatus } from "../../../../shared/protocol";
import { statusWith } from "../../../tests/status-fixture";
import type { ServerFinding } from "../../reachability";
import { startGuide, type StartGuide } from "../steps";

const states = (guide: StartGuide) => guide.steps.map((step) => `${step.key}:${step.state}`);
const FOUND: ServerFinding = { origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100", found: true, gatewayUrl: "ws://127.0.0.1:4877/client" };
const NOT_FOUND: ServerFinding = { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000", found: false };

test("disconnected and never approved: every step in order, nothing ticked, Connect is the button", () => {
  const guide = startGuide(statusWith(), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["start:current", "signin:todo", "connect:todo", "approve:todo"]);
  assert.deepEqual(guide.connect, { label: "Connect", action: "connect" });
  assert.equal(guide.pairingCode, undefined);
  assert.equal(guide.steps[2]?.line, "Press Connect so FluxIQ can work in this browser.");
  assert.doesNotMatch(guide.line, /three/iu, "the heading line no longer says three steps");
});

test("the AI key is not a step: the key card says it, in the chat and in Settings", () => {
  for (const state of ["disconnected", "connecting", "reconnecting", "pairing", "error", "connected"] as const) {
    const guide = startGuide(statusWith({ connectionState: state, paired: true }), false);
    assert.equal(guide.steps.some((item) => (item.key as string) === "key"), false, state);
    assert.doesNotMatch(JSON.stringify(guide), /model key|unlock|password/iu, state);
  }
});

test("step one says how FluxIQ starts, in words; step two says to sign in", () => {
  const guide = startGuide(statusWith(), false);
  assert.match(guide.steps[0]?.line ?? "", /running on this computer/u);
  assert.doesNotMatch(guide.steps[0]?.line ?? "", /pnpm|folder|!FluxIQ/u, "the first step names no command or folder");
  assert.match(guide.steps[1]?.line ?? "", /sign in/iu);
  for (const state of ["disconnected", "connecting", "reconnecting", "pairing", "error"] as const) {
    for (const item of startGuide(statusWith({ connectionState: state }), false).steps) {
      assert.doesNotMatch(`${item.title} ${item.line ?? ""}`, /ws:|wss:|127\.0\.0\.1|localhost/u, `${state}/${item.key}: no address in the words until a server was looked for`);
    }
  }
});

test("every step keeps its own title, done or not", () => {
  for (const state of ["disconnected", "pairing", "connected"] as const) {
    const titles = startGuide(statusWith({ connectionState: state, paired: true }), false, undefined, state === "disconnected" ? FOUND : undefined).steps.map((item) => item.title);
    assert.deepEqual(titles, ["Start FluxIQ", "Sign in to FluxIQ", "Connect this browser", "Approve this browser in FluxIQ"], state);
  }
});

test("disconnected but approved before: signing in stays done, and approval is not claimed", () => {
  const guide = startGuide(statusWith({ paired: true }), false);
  assert.deepEqual(states(guide), ["start:current", "signin:done", "connect:todo", "approve:todo"]);
  assert.equal(guide.steps[2]?.line, "Connect to pick up where you left off.");
  assert.equal(guide.steps[3]?.line, "This browser was approved earlier. Connect to check it still is.");
});

test("connecting and reconnecting: the connect step is under way, with Cancel or Try now", () => {
  const connecting = startGuide(statusWith({ connectionState: "connecting" }), false);
  assert.deepEqual(states(connecting), ["start:current", "signin:todo", "connect:waiting", "approve:todo"]);
  assert.deepEqual(connecting.connect, { label: "Cancel", action: "disconnect" });
  const reconnecting = startGuide(statusWith({ connectionState: "reconnecting", paired: true }), false);
  assert.deepEqual(states(reconnecting), ["start:current", "signin:done", "connect:waiting", "approve:todo"]);
  assert.deepEqual(reconnecting.connect, { label: "Try now", action: "connect" });
});

test("step four is never done while the browser is not connected", () => {
  for (const connectionState of ["disconnected", "connecting", "reconnecting", "error", "pairing"] as const) {
    for (const paired of [false, true]) {
      assert.notEqual(startGuide(statusWith({ connectionState, paired }), false).steps.find((item) => item.key === "approve")?.state, "done", `${connectionState} paired=${paired}`);
    }
  }
  assert.equal(startGuide(statusWith({ connectionState: "connected", paired: true }), false).steps.find((item) => item.key === "approve")?.state, "done");
});

test("after a refused or lost connection step four says FluxIQ may have removed this browser, in the same words as Settings", () => {
  for (const connectionState of ["error", "reconnecting"] as const) {
    const line = startGuide(statusWith({ connectionState, paired: true }), false).steps.find((item) => item.key === "approve")?.line;
    assert.equal(line, "FluxIQ may have removed this browser. Connect again to ask for approval.", connectionState);
  }
  assert.equal(startGuide(statusWith({ connectionState: "error", paired: false }), false).steps.find((item) => item.key === "approve")?.line, "FluxIQ may have removed this browser. Connect again to ask for approval.");
});

test("pairing: FluxIQ is reached and connected, approval is under way with the code", () => {
  const guide = startGuide(statusWith({ connectionState: "pairing", pairingReferenceCode: "482913" }), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["start:done", "signin:waiting", "connect:done", "approve:waiting"]);
  assert.equal(guide.pairingCode, "482913");
  assert.equal(guide.connect, undefined, "no Connect while waiting for approval");
  assert.equal(startGuide(statusWith({ connectionState: "pairing" }), false).pairingCode, "------", "a code not yet sent shows as dashes");
});

test("connected: the chat comes back, steps one to four are done and nothing is said of the key", () => {
  const guide = startGuide(statusWith({ connectionState: "connected", paired: true }), false);
  assert.equal(guide.gated, false);
  assert.deepEqual(states(guide), ["start:done", "signin:done", "connect:done", "approve:done"]);
});

test("before the first status: a checking line, no steps, and the chat not yet shown", () => {
  const guide = startGuide(undefined, false);
  assert.equal(guide.gated, true);
  assert.equal(guide.line, "Checking the connection...");
  assert.deepEqual(guide.steps, []);
});

test("no tick on anything not detected: before connecting only a stored sign-in ticks", () => {
  for (const state of ["disconnected", "connecting", "reconnecting", "error"] as const) {
    const done = startGuide(statusWith({ connectionState: state }), false).steps.filter((item) => item.state === "done");
    assert.deepEqual(done, [], state);
  }
});

test("FluxIQ unreachable: the first step is the problem, in words, with Try again and a way to the address", () => {
  const guide = startGuide(statusWith({ connectionState: "error" }), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["start:problem", "signin:todo", "connect:todo", "approve:todo"]);
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

test("a valid FluxIQ found at the configured address: step one is done, says where, offers Change; sign-in is next", () => {
  const guide = startGuide(statusWith(), false, undefined, FOUND);
  assert.deepEqual(states(guide), ["start:done", "signin:current", "connect:todo", "approve:todo"]);
  assert.equal(guide.steps[0]?.line, "FluxIQ found at 127.0.0.1:3100");
  assert.equal(guide.steps[0]?.change, true);
  assert.deepEqual(guide.server, FOUND);
});

test("FluxIQ found and the browser was approved before: Start is done, Sign in stays done, Connect is the button", () => {
  const guide = startGuide(statusWith({ paired: true }), false, undefined, FOUND);
  assert.deepEqual(states(guide).slice(0, 3), ["start:done", "signin:done", "connect:todo"]);
});

test("nothing valid at the configured address: step one is not done, says the address it asked, and offers Change", () => {
  const guide = startGuide(statusWith(), false, undefined, NOT_FOUND);
  assert.equal(guide.steps[0]?.state, "current");
  assert.match(guide.steps[0]?.line ?? "", /isn't answering at 127\.0\.0\.1:3000/u);
  assert.equal(guide.steps[0]?.change, true);
});

test("not asked yet: Start FluxIQ stays the next step and claims no address", () => {
  const guide = startGuide(statusWith(), false);
  assert.equal(guide.steps[0]?.state, "current");
  assert.equal(guide.steps[0]?.change, undefined);
  assert.equal(guide.server, undefined);
});
