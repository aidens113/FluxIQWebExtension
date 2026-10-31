import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationRuntimeAdapter } from "../adapter";

const REFERENCE = Date.UTC(2026, 9, 6, 23, 59);
const READ = { item: ".event", fields: { when: ".when" }, where: [{ field: "when", within: "1 day" }] };

async function sentRead(referenceNow?: number, now?: number): Promise<JsonObject> {
  let sent: JsonObject | undefined;
  const fluxiq = { programs: {
    clientGateway: { snapshot: () => ({ sessions: [{ sessionId: "test.session", clientId: "test.client", status: "ready", clientType: "extension", capabilities: [{ id: "web.actions", metadata: { domainId: "web-automation" } }] }] }) },
    automationStudioClientGateway: { executeAction: async (_session: string, command: { parameters: JsonObject }) => {
      sent = command.parameters;
      return { commandId: "test.command", status: "succeeded", payload: {} };
    } }
  } } as unknown as FluxIQ;
  const parameters = { extractList: { ...READ, ...(now === undefined ? {} : { now }) } };
  const result = await createWebAutomationRuntimeAdapter({ fluxiq }).execute(
    { kind: "execute_action", outputId: "web.dom.extract_list", parameters },
    referenceNow === undefined ? {} : { referenceNow }
  );
  assert.equal(result.status, "succeeded");
  assert.equal(Object.hasOwn(parameters.extractList, "now"), now !== undefined, "authored command is not mutated");
  assert.ok(sent);
  return sent.extractList as JsonObject;
}

test("runtime extraction sends the enclosing reference after wall-clock midnight", async (t) => {
  t.mock.method(Date, "now", () => Date.UTC(2026, 9, 7, 0, 1));
  assert.equal((await sentRead(REFERENCE)).now, REFERENCE);
});

test("runtime extraction preserves explicit request now", async () => {
  assert.equal((await sentRead(REFERENCE, 123)).now, 123);
});

test("legacy runtime extraction without a reference retains the page clock fallback", async () => {
  assert.equal(Object.hasOwn(await sentRead(), "now"), false);
});
