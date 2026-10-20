// What the extension's interference clearing pressed rides on the client
// payload as `clearedLayers` (t401). Core reads it from the top of the dispatch
// payload, as it reads `route`, so the dispatcher lifts it there, copied
// through its closed vocabulary.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ, OutputDispatchResult } from "fluxiq";
import { runWithAutomationStudioEvidenceBuildScope } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { webAutomationClearedWayOutsOf } from "../../cleared-way-outs";
import { dispatchWebAutomationOutput } from "../gateway-output-dispatcher";
import { webAutomationOutputNodeId } from "../../output-nodes";
import { bindWebAutomationLlmEvidenceRuntime, type WebAutomationLlmEvidenceRuntime } from "../../runtime/llm-evidence";
import { coreBuildStateOwner, type CoreBuildStateOwner } from "../../runtime/llm-evidence/node-run/build-state/tests/core-store";

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

// t516: the layer's own name and the pressed control's name are lifted beside the closed words, so Core can turn the
// close into a handler; the descriptor still stays here.
test("a layer's name and the name of the control pressed reach Core beside the closed words", async () => {
  const wayOut = { url: "https://library.test/catalogue", element: { tagName: "button", selector: "#later", visibleText: "Maybe later" } };
  const payload = { status: "succeeded", clearedLayers: [{ kind: "dialog", control: "Maybe later", name: "Join the reading club for free holds", controlName: "Maybe later, I will browse first", wayOut }] } as unknown as JsonObject;
  const result = await dispatchWith(payload);
  const [lifted] = result.payload?.clearedLayers as Array<Record<string, unknown>>;
  assert.equal(lifted?.name, "Join the reading club for free holds");
  assert.equal(lifted?.controlName, "Maybe later, I will browse first");
  assert.match(String(lifted?.wayOut), /^way-out\.[0-9a-f]{32}$/u);
  assert.doesNotMatch(JSON.stringify(result.payload), /library\.test|#later/u);
});

// t516: Core learns a closed layer as a handler whose step presses the way out. Core names no domain's steps, so the
// dispatcher says which of this domain's node definitions presses it, beside the reference; a layer with no way out
// names none.
test("a layer closed by a way out names the node definition that presses it; one with no way out names none", async () => {
  const wayOut = { url: "https://library.test/catalogue", element: { tagName: "button", selector: "#later", visibleText: "Maybe later" } };
  const payload = { status: "succeeded", clearedLayers: [{ kind: "dialog", control: "Maybe later", name: "Join the reading club", wayOut }, { kind: "dialog", control: "Close" }] } as unknown as JsonObject;
  const result = await dispatchWith(payload);
  const [pressed, unpressed] = result.payload?.clearedLayers as Array<Record<string, unknown>>;
  assert.equal(pressed?.wayOutDefinitionId, webAutomationOutputNodeId("web.dom.click"));
  assert.equal(Object.hasOwn(unpressed ?? {}, "wayOutDefinitionId"), false);
});

test("a playback close resolves through the bound domain without exploration or a model look", async () => {
  const wayOut = { url: "https://library.test/catalogue", element: { tagName: "button", selector: "#later", accessibleName: "Maybe later", visibleText: "Maybe later" } };
  const payload = { status: "succeeded", clearedLayers: [{ kind: "dialog", control: "Maybe later", name: "Reading club", wayOut }] } as unknown as JsonObject;
  const fluxiq = fakeFluxIQ(payload);
  let runtime: WebAutomationLlmEvidenceRuntime | undefined;
  Object.assign(fluxiq.programs, { automationStudio: { bindLlmEvidenceRuntime: (bound: WebAutomationLlmEvidenceRuntime) => { runtime = bound; } } });
  bindWebAutomationLlmEvidenceRuntime(fluxiq);
  const result = await dispatchWith(payload, fluxiq);
  const [layer] = result.payload?.clearedLayers as Array<{ wayOut: string; wayOutDefinitionId: string }>;
  assert.ok(runtime);
  const scope = { projectId: "project.playback", flowId: "flow.saved" };
  const handles = await runtime.clearedControlHandles!({ ...scope, wayOuts: [layer!.wayOut] });
  const handle = handles[layer!.wayOut];
  assert.ok(handle);
  const resolved = await runtime.resolvePlanNodeParameters({ ...scope, nodeDefinitionId: layer!.wayOutDefinitionId, parameters: { target: { handle } }, declaredConsequences: [], handleReach: "view_history" });
  assert.equal(resolved.status, "resolved");
  if (resolved.status === "resolved") {
    assert.equal(resolved.parameters.selector, "#later");
    assert.equal(JSON.stringify(resolved.parameters).includes('"handle"'), false);
  }
});

// t728: a way out pressed while Core ran a call for a Flow is kept with that Flow in Core's durable build state, so a
// host restarted before the trial asks still names it -- the reference Core carried, resolved by the restarted runtime.
test("a way out pressed for a Flow is still named for it after the host restarts", async () => {
  const wayOut = { url: "https://library.test/catalogue", element: { tagName: "button", selector: "#later", accessibleName: "Maybe later", visibleText: "Maybe later" } };
  const payload = { status: "succeeded", clearedLayers: [{ kind: "dialog", control: "Maybe later", name: "Reading club", wayOut }] } as unknown as JsonObject;
  const scope = { projectId: "project.library", flowId: "flow.holds" };
  const storage = coreBuildStateOwner();
  const host = (owner: CoreBuildStateOwner): FluxIQ => {
    const fluxiq = fakeFluxIQ(payload);
    Object.assign(fluxiq, { domains: owner.domains });
    Object.assign(fluxiq.programs, { automationStudio: owner.programs.automationStudio });
    return fluxiq;
  };

  const before = host(storage);
  const result = await runWithAutomationStudioEvidenceBuildScope({ ...scope, buildId: "build.one" }, () => dispatchWith(payload, before));
  const [layer] = result.payload?.clearedLayers as Array<{ wayOut: string }>;

  const after = host(coreBuildStateOwner(storage.programs.automationStudio.domainBuildState));
  assert.equal(webAutomationClearedWayOutsOf(after).get(layer!.wayOut), undefined);
  let runtime: WebAutomationLlmEvidenceRuntime | undefined;
  Object.assign(after.programs.automationStudio, { bindLlmEvidenceRuntime: (bound: WebAutomationLlmEvidenceRuntime) => { runtime = bound; } });
  bindWebAutomationLlmEvidenceRuntime(after);
  assert.ok(runtime);
  const handles = await runtime.clearedControlHandles!({ ...scope, wayOuts: [layer!.wayOut] });
  assert.ok(handles[layer!.wayOut]);
  // Another Flow was never pressed it.
  assert.deepEqual(await runtime.clearedControlHandles!({ ...scope, flowId: "flow.other", wayOuts: [layer!.wayOut] }), {});
});
