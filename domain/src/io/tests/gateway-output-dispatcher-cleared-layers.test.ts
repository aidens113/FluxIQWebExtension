// What the extension's interference clearing pressed rides on the client
// payload as `clearedLayers` (t401). Core reads it from the top of the dispatch
// payload, as it reads `route`, so the dispatcher lifts it there, copied
// through its closed vocabulary.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ, OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { webAutomationClearedWayOutsOf } from "../../cleared-way-outs";
import { dispatchWebAutomationOutput } from "../gateway-output-dispatcher";

async function dispatchWith(payload: JsonObject | undefined, fluxiq: FluxIQ = fakeFluxIQ(payload)): Promise<OutputDispatchResult<JsonObject>> {
  return await dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: "web.dom.click", payload: { selector: "#confirm" } });
}

function fakeFluxIQ(payload: JsonObject | undefined): FluxIQ {
  return {
    programs: {
      clientGateway: {
        snapshot: () => ({
          sessions: [{
            sessionId: "session.one", clientId: "client.one", status: "ready", clientType: "extension",
            capabilities: [{ id: "web.actions", actionTypes: ["web.dom.click"] }]
          }]
        })
      },
      automationStudioClientGateway: {
        executeAction: async () => ({ commandId: "client.command.click", status: "succeeded", ...(payload ? { payload } : {}) })
      }
    }
  } as unknown as FluxIQ;
}

test("layers the clearing closed are lifted to the top of the dispatch payload", async () => {
  const result = await dispatchWith({ status: "succeeded", clearedLayers: [{ kind: "rate_limit", control: "OK" }, { kind: "dialog", control: "Not now" }] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload?.clearedLayers, [{ kind: "rate_limit", control: "OK" }, { kind: "dialog", control: "Not now" }]);
});

test("nothing cleared, or only unknown words, puts no clearedLayers on the dispatch payload", async () => {
  for (const payload of [
    { status: "succeeded" },
    { status: "succeeded", clearedLayers: [] },
    { status: "succeeded", clearedLayers: [{ kind: "rate_limit", control: "Try again" }] },
    { status: "succeeded", clearedLayers: "OK" },
    undefined
  ] as (JsonObject | undefined)[]) {
    const result = await dispatchWith(payload);
    assert.equal(Object.hasOwn(result.payload ?? {}, "clearedLayers"), false, JSON.stringify(payload));
  }
});

// t470: the way out a layer was closed by stays on this domain's server half; Core carries an opaque reference to it,
// and neither the lifted layers nor the client's own result hand Core the descriptor.
test("the way out each layer was closed by is kept here, and Core is handed only a reference to it", async () => {
  const wayOut = { url: "https://social.test/requests", element: { tagName: "button", selector: "#rate-limit-ok", visibleText: "OK", accessibleName: "OK" } };
  const payload = { status: "succeeded", clearedLayers: [{ kind: "rate_limit", control: "OK", wayOut }, { kind: "dialog", control: "Not now" }] } as unknown as JsonObject;
  const fluxiq = fakeFluxIQ(payload);
  const result = await dispatchWith(payload, fluxiq);
  const lifted = result.payload?.clearedLayers as Array<{ kind: string; control: string; wayOut?: string }>;
  assert.equal(lifted.length, 2);
  assert.match(lifted[0]!.wayOut ?? "", /^way-out\.[0-9a-f]{32}$/u);
  assert.deepEqual(lifted[1], { kind: "dialog", control: "Not now" });
  assert.deepEqual((result.payload?.result as { clearedLayers?: unknown }).clearedLayers, lifted);
  assert.doesNotMatch(JSON.stringify(result.payload), /rate-limit-ok|social\.test/u);
  assert.deepEqual(webAutomationClearedWayOutsOf(fluxiq).get(lifted[0]!.wayOut!), wayOut);
  assert.equal(webAutomationClearedWayOutsOf(fakeFluxIQ(payload)).get(lifted[0]!.wayOut!), undefined);
});

test("a way out that is not a web page's address and one descriptor is dropped, and its layer kept", async () => {
  for (const wayOut of [{ url: "javascript:alert(1)", element: { tagName: "button" } }, { url: "https://social.test/", element: [] }, { url: "https://social.test/", element: { text: "x".repeat(20_000) } }, "OK"]) {
    const result = await dispatchWith({ status: "succeeded", clearedLayers: [{ kind: "rate_limit", control: "OK", wayOut }] } as unknown as JsonObject);
    assert.deepEqual(result.payload?.clearedLayers, [{ kind: "rate_limit", control: "OK" }], JSON.stringify(wayOut).slice(0, 60));
  }
});
