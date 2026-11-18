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
const approveLine = (guide: StartGuide) => guide.steps.find((item) => item.key === "approve")?.line;

test("disconnected and never approved: three steps in order, nothing ticked, Connect is the button", () => {
  const guide = startGuide(statusWith(), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["start:current", "approve:todo", "key:todo"]);
  assert.deepEqual(guide.connect, { label: "Connect", action: "connect" });
  assert.equal(guide.pairingCode, undefined);
  assert.equal(guide.autoConnect, false, "nothing was found yet, so nothing is sent");
  assert.doesNotMatch(guide.line, /three/iu, "the heading line no longer says three steps");
});

test("there is no separate Sign in step: it is not known, so the approve step says to sign in if FluxIQ asks", () => {
  for (const state of ["disconnected", "connecting", "reconnecting", "pairing", "error", "connected"] as const) {
    for (const paired of [false, true]) {
      const guide = startGuide(statusWith({ connectionState: state, paired }), false, undefined, FOUND);
      assert.equal(guide.steps.some((item) => (item.key as string) === "signin"), false, `${state} paired=${paired}`);
      assert.equal(guide.steps.some((item) => /^Sign in/u.test(item.title)), false, `${state} paired=${paired}`);
    }
  }
  assert.match(approveLine(startGuide(statusWith({ connectionState: "pairing" }), false)) ?? "", /sign in if it asks/iu);
});

test("the AI key is the last step, a plain to-do the key card in the chat answers; no reading, no banned words", () => {
  for (const state of ["disconnected", "connecting", "reconnecting", "pairing", "error"] as const) {
    const guide = startGuide(statusWith({ connectionState: state, paired: true }), false);
    assert.equal(guide.steps.at(-1)?.key, "key", state);
    assert.equal(guide.steps.at(-1)?.title, "Add your AI key", state);
    assert.equal(guide.steps.at(-1)?.state, "todo", state);
    assert.doesNotMatch(JSON.stringify(guide), /unlock|vault|seal|credential|token|scope|password/iu, state);
  }
});

test("step one says how FluxIQ starts, in words; the connect step says it asks by itself", () => {
  const guide = startGuide(statusWith(), false);
  assert.match(guide.steps[0]?.line ?? "", /running on this computer/u);
  assert.doesNotMatch(guide.steps[0]?.line ?? "", /pnpm|folder|!FluxIQ/u, "the first step names no command or folder");
  assert.match(approveLine(guide) ?? "", /asks it for approval by itself/u);
  for (const state of ["disconnected", "connecting", "reconnecting", "pairing", "error"] as const) {
    for (const item of startGuide(statusWith({ connectionState: state }), false).steps) {
      assert.doesNotMatch(`${item.title} ${item.line ?? ""}`, /ws:|wss:|127\.0\.0\.1|localhost/u, `${state}/${item.key}: no address in the words until a server was looked for`);
    }
  }
});

test("every step keeps its own title, done or not", () => {
  for (const state of ["disconnected", "pairing", "connected"] as const) {
    const titles = startGuide(statusWith({ connectionState: state, paired: true }), false, undefined, state === "disconnected" ? FOUND : undefined).steps.map((item) => item.title);
    assert.deepEqual(titles, ["Start FluxIQ", "Connect and approve", "Add your AI key"], state);
  }
});

test("FluxIQ found, nothing asked yet: the request goes out by itself and the step says it is asking", () => {
  const guide = startGuide(statusWith(), false, undefined, FOUND);
  assert.equal(guide.autoConnect, true);
  assert.deepEqual(states(guide), ["start:done", "approve:waiting", "key:todo"]);
  assert.equal(approveLine(guide), "Asking FluxIQ for approval...");
  // Also for a browser approved before: the stored approval is used, and the request still goes out.
  assert.equal(startGuide(statusWith({ paired: true }), false, undefined, FOUND).autoConnect, true);
});

test("the request is sent by itself only when nothing has asked yet: not found, already sent, or connected before", () => {
  assert.equal(startGuide(statusWith(), false, undefined, NOT_FOUND).autoConnect, false, "nothing valid answered");
  assert.equal(startGuide(statusWith(), false).autoConnect, false, "not asked where FluxIQ is yet");
  const sent = startGuide(statusWith(), false, undefined, FOUND, { autoSent: true });
  assert.equal(sent.autoConnect, false, "it already went out once; Connect is the retry");
  assert.deepEqual(sent.connect, { label: "Connect", action: "connect" });
  assert.equal(startGuide(statusWith({ paired: true }), false, undefined, FOUND, { wasConnected: true }).autoConnect, false, "a person who was connected is not asked again by itself");
  for (const state of ["connecting", "reconnecting", "pairing", "error", "connected"] as const) {
    assert.equal(startGuide(statusWith({ connectionState: state }), false, undefined, FOUND).autoConnect, false, state);
  }
  assert.equal(startGuide(statusWith(), false, "pairing", FOUND).autoConnect, false, "a lost wait waits for the person's Connect");
});

test("after a cancelled request the step says not connected and Connect is the button", () => {
  const guide = startGuide(statusWith(), false, undefined, FOUND, { autoSent: true });
  assert.deepEqual(states(guide), ["start:done", "approve:todo", "key:todo"]);
  assert.equal(approveLine(guide), "Not connected. Connect again.");
});

test("connecting and reconnecting: the connect step is under way, with Cancel or Try now", () => {
  const connecting = startGuide(statusWith({ connectionState: "connecting" }), false);
  assert.deepEqual(states(connecting), ["start:current", "approve:waiting", "key:todo"]);
  assert.deepEqual(connecting.connect, { label: "Cancel", action: "disconnect" });
  const reconnecting = startGuide(statusWith({ connectionState: "reconnecting", paired: true }), false);
  assert.deepEqual(states(reconnecting), ["start:current", "approve:waiting", "key:todo"]);
  assert.deepEqual(reconnecting.connect, { label: "Try now", action: "connect" });
});

test("the approve step is never done while the browser is not connected", () => {
  for (const connectionState of ["disconnected", "connecting", "reconnecting", "error", "pairing"] as const) {
    for (const paired of [false, true]) {
      assert.notEqual(startGuide(statusWith({ connectionState, paired }), false).steps.find((item) => item.key === "approve")?.state, "done", `${connectionState} paired=${paired}`);
    }
  }
  assert.equal(startGuide(statusWith({ connectionState: "connected", paired: true }), false).steps.find((item) => item.key === "approve")?.state, "done");
});

test("a refused connection that FluxIQ answered with a removal says access was removed; any other loss says not connected", () => {
  const removed = "Access was removed. Connect again to ask for approval.";
  const refused = startGuide(statusWith({ connectionState: "error", paired: true, enrolmentRefusalCode: "enrolment.revoked" }), false);
  assert.equal(approveLine(refused), removed);
  // The trust is also gone when the approval was dropped after this panel had seen the browser connected.
  assert.equal(approveLine(startGuide(statusWith({ connectionState: "disconnected", paired: false }), false, undefined, FOUND, { wasConnected: true })), removed);
  assert.equal(approveLine(startGuide(statusWith({ connectionState: "error", paired: false }), false, undefined, undefined, { wasConnected: true })), removed);
  // Anything else is only a loss.
  for (const connectionState of ["error", "disconnected"] as const) {
    assert.equal(approveLine(startGuide(statusWith({ connectionState, paired: true }), false)), "Not connected. Connect again.", connectionState);
  }
  assert.equal(approveLine(startGuide(statusWith({ connectionState: "error", paired: false }), false)), "Not connected. Connect again.");
  const words = JSON.stringify([removed, "Not connected. Connect again."]);
  assert.doesNotMatch(words, /approved earlier|may have removed|unlock|vault|seal|credential|token|scope/iu);
});

test("pairing: FluxIQ is reached and connected, approval is under way with the code", () => {
  const guide = startGuide(statusWith({ connectionState: "pairing", pairingReferenceCode: "482913" }), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["start:done", "approve:waiting", "key:todo"]);
  assert.equal(guide.pairingCode, "482913");
  assert.equal(guide.connect, undefined, "no Connect while waiting for approval");
  assert.equal(startGuide(statusWith({ connectionState: "pairing" }), false).pairingCode, "------", "a code not yet sent shows as dashes");
});

test("connected: the chat comes back and the steps before the key are done", () => {
  const guide = startGuide(statusWith({ connectionState: "connected", paired: true }), false);
  assert.equal(guide.gated, false);
  assert.deepEqual(states(guide), ["start:done", "approve:done", "key:todo"]);
});

test("before the first status: a checking line, no steps, and the chat not yet shown", () => {
  const guide = startGuide(undefined, false);
  assert.equal(guide.gated, true);
  assert.equal(guide.line, "Checking the connection...");
  assert.deepEqual(guide.steps, []);
  assert.equal(guide.autoConnect, false);
});

test("no tick on anything not detected before connecting", () => {
  for (const state of ["disconnected", "connecting", "reconnecting", "error"] as const) {
    const done = startGuide(statusWith({ connectionState: state, paired: true }), false).steps.filter((item) => item.state === "done");
    assert.deepEqual(done, [], state);
  }
});

test("FluxIQ unreachable: the first step is the problem, in words, with Try again and a way to the address", () => {
  const guide = startGuide(statusWith({ connectionState: "error" }), false);
  assert.equal(guide.gated, true);
  assert.deepEqual(states(guide), ["start:problem", "approve:todo", "key:todo"]);
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

test("a valid FluxIQ found at the configured address: step one is done, says where, offers Change", () => {
  const guide = startGuide(statusWith(), false, undefined, FOUND);
  assert.equal(guide.steps[0]?.state, "done");
  assert.equal(guide.steps[0]?.line, "FluxIQ found at 127.0.0.1:3100");
  assert.equal(guide.steps[0]?.change, true);
  assert.deepEqual(guide.server, FOUND);
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
