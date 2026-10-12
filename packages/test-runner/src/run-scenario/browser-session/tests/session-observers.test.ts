import assert from "node:assert/strict";
import test from "node:test";
import type { launchBrowser } from "../launch-browser.js";
import type { DeterministicNetworkGuard } from "../../../network-guard.js";
import { sessionObservers } from "../session-observers.js";

test("context replacement rebinds observers while registering capture and step watching once", () => {
  const events: string[] = [];
  const adopted: unknown[] = [];
  const guard = {} as DeterministicNetworkGuard;
  const options = sessionObservers({
    scenarioOrigins: [], trace: { attach: async () => undefined, mark: () => undefined },
    adoptSession: session => { adopted.push(session);
      events.push("adopt"); },
    adoptGuard: value => { assert.equal(value, guard);
      events.push("guard"); },
    watchConsole: session => {
      assert.equal(session, adopted.at(-1));
      events.push("watch");
      return { dispose: () => { events.push("dispose"); } };
    },
    startCapture: () => { events.push("capture"); },
    watchSteps: () => { events.push("steps"); },
  });
  const first = { browserVersion: "first" } as Awaited<ReturnType<typeof launchBrowser>>;
  const second = { browserVersion: "second" } as Awaited<ReturnType<typeof launchBrowser>>;
  options.onLaunched!(first);
  options.onGuard!(guard);
  options.onLaunched!(second);
  options.onGuard!(guard);
  assert.deepEqual(adopted, [first, second]);
  assert.deepEqual(events, ["adopt", "capture", "steps", "guard", "watch", "dispose", "adopt", "guard", "watch"]);
});
