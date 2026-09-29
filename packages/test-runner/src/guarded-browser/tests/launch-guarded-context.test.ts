import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext } from "@playwright/test";
import { launchGuardedPersistentContext } from "../launch-guarded-context.js";

const POLICY = { scenarioOrigins: ["http://127.0.0.1:4100"], fluxiqOrigins: ["http://127.0.0.1:4200"], gatewayOrigins: ["ws://127.0.0.1:4300"] };

/** A context that records the order in which the launcher touched it. */
function recordingContext(events: string[], failRoute = false): BrowserContext {
  return {
    route: async () => { events.push("route"); if (failRoute) throw new Error("route refused"); },
    routeWebSocket: async () => { events.push("routeWebSocket"); },
    serviceWorkers: () => [],
    on: () => undefined,
    close: async () => { events.push("close"); },
  } as unknown as BrowserContext;
}

test("the context is returned only after the guard is installed, with containment appended to the caller's switches", async () => {
  const events: string[] = [];
  let launched: { directory: string; options: Record<string, unknown> } | undefined;
  const { context, guard } = await launchGuardedPersistentContext("C:/profiles/one", { headless: true, locale: "en-US", args: ["--no-first-run"] }, POLICY, async (directory, options) => {
    launched = { directory, options: options as Record<string, unknown> };
    events.push("launch");
    return recordingContext(events);
  });
  assert.deepEqual(events, ["launch", "route", "routeWebSocket"]);
  assert.equal(launched?.directory, "C:/profiles/one");
  assert.equal(launched?.options.locale, "en-US");
  assert.deepEqual(launched?.options.args, [
    "--no-first-run",
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1",
    "--no-proxy-server",
  ]);
  assert.ok(context);
  assert.deepEqual(guard.violations(), []);
});

test("a guard that cannot be installed closes the browser and reports the guard's failure", async () => {
  const events: string[] = [];
  await assert.rejects(
    launchGuardedPersistentContext("C:/profiles/two", { headless: true }, POLICY, async () => { events.push("launch"); return recordingContext(events, true); }),
    /route refused/u,
  );
  assert.deepEqual(events, ["launch", "route", "close"]);
});

test("a policy whose host cannot be written as a resolver rule never launches a browser", async () => {
  let launches = 0;
  await assert.rejects(
    launchGuardedPersistentContext("C:/profiles/three", {}, { scenarioOrigins: [], fluxiqOrigins: ["http://a,b"] }, async () => { launches += 1; return recordingContext([]); }),
    /not a plain DNS name/u,
  );
  assert.equal(launches, 0);
});
