import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioNativeNodeContext } from "fluxiq/automation-studio/nodes";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationOutputNodeImplementationBundle } from "../native-runtime";

const REFERENCE = Date.UTC(2026, 9, 6, 23, 59);
const READ = { item: ".event", fields: { when: ".when" }, where: [{ field: "when", within: "1 day" }] };

async function sentRead(host?: AutomationStudioNativeNodeContext["host"], now?: number): Promise<JsonObject> {
  const implementation = createWebAutomationOutputNodeImplementationBundle().implementations["web.dom.extract_list"]!;
  const context = {
    inputs: {}, parameters: { extractList: { ...READ, ...(now === undefined ? {} : { now }) } },
    log: () => undefined, ...(host === undefined ? {} : { host })
  } as unknown as AutomationStudioNativeNodeContext;
  const result = await implementation(context);
  assert.equal(result.status, "success");
  const payload = result.effects?.[0]?.payload as JsonObject;
  return (payload.parameters as JsonObject).extractList as JsonObject;
}

const host = { referenceNow: REFERENCE, capabilityIds: [], sideEffectClass: "none" } as const;

test("native extraction sends the supplied host reference after wall-clock midnight", async (t) => {
  t.mock.method(Date, "now", () => Date.UTC(2026, 9, 7, 0, 1));
  assert.equal((await sentRead({ ...host, capabilityIds: [] })).now, REFERENCE);
});

test("native extraction preserves an explicit request now over the host reference", async () => {
  assert.equal((await sentRead({ ...host, capabilityIds: [] }, 123)).now, 123);
});

test("legacy native extraction without host date metadata leaves the page clock fallback", async () => {
  assert.equal(Object.hasOwn(await sentRead(), "now"), false);
  assert.equal(Object.hasOwn(await sentRead({ capabilityIds: [], sideEffectClass: "none" }), "now"), false);
});
