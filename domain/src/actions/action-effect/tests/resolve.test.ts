import assert from "node:assert/strict";
import test from "node:test";
import { AutomationStudioNativeNodeRuntime } from "fluxiq/automation-studio";
import { createWebAutomationOutputNodeManifest, createWebAutomationOutputNodeImplementationBundle } from "../../../output-nodes";
import { resolveAutomationStudioNodeActionEffect } from "fluxiq/automation-studio/action-effect";
import { WEB_AUTOMATION_ACTION_TYPES } from "../../types";
import { webAutomationOutputNodeDefinitions } from "../../../output-nodes";
import { webAutomationActionDeclarationRequired } from "../../consequence-declaration";
import { WEB_AUTOMATION_NODE_ACTION_EFFECT, webAutomationResolvedActionEffect } from "..";

const EXPECTED = {
  observe: ["web.dom.scroll", "web.dom.wait_for_selector", "web.dom.wait_for_text", "web.dom.extract", "web.dom.extract_list", "web.dom.capture_snapshot", "web.dom.assert"],
  state: ["web.browser.navigate", "web.dom.type", "web.dom.clear", "web.dom.select", "web.dom.check", "web.dom.upload"],
  commit: ["web.browser.download", "web.browser.tab", "web.dom.click", "web.dom.keypress", "web.dom.dialog", "web.dom.next_page"]
};

test("all native verbs carry the canonical floor and preserve the existing declaration rule", () => {
  assert.deepEqual(Object.keys(WEB_AUTOMATION_NODE_ACTION_EFFECT).sort(), [...WEB_AUTOMATION_ACTION_TYPES].sort());
  for (const [effectClass, actions] of Object.entries(EXPECTED)) {
    for (const action of actions) {
      const node = webAutomationOutputNodeDefinitions.find((item) => item.outputAction?.fixedOutputId === action);
      assert.ok(node, action);
      const resolved = resolveAutomationStudioNodeActionEffect(node, {});
      assert.equal(resolved?.effectClass, effectClass, action);
      assert.deepEqual(resolved?.permissionConsequences, [], action);
      assert.equal(resolved?.repeatSafe, ["web.dom.type", "web.dom.clear", "web.dom.select", "web.dom.check", "web.browser.navigate"].includes(action) ? true : undefined, action);
      assert.deepEqual(webAutomationResolvedActionEffect(action, {}), resolveAutomationStudioNodeActionEffect(node, {}), action);
      assert.ok(node.metadata?.effect === "observe" || node.metadata?.effect === "mutate");
    }
  }
  for (const action of ["web.browser.download", "web.browser.tab", "web.dom.next_page"] as const) {
    assert.equal(webAutomationActionDeclarationRequired(action, {}), false);
  }
});

test("only known false or trusted default false disproves submit; bindings stay conservative", () => {
  const node = webAutomationOutputNodeDefinitions.find((item) => item.outputAction?.fixedOutputId === "web.dom.type");
  assert.ok(node);
  assert.equal(node.parameters.find((parameter) => parameter.id === "submit")?.defaultValue, false);
  for (const parameters of [{}, { submit: false }]) assert.equal(webAutomationResolvedActionEffect("web.dom.type", parameters)?.effectClass, "state");
  for (const submit of [true, undefined, null, "false", 0, { kind: "state", path: "submit", fallback: false }]) {
    assert.equal(webAutomationResolvedActionEffect("web.dom.type", { submit })?.effectClass, "commit");
    assert.deepEqual(webAutomationResolvedActionEffect("web.dom.type", { submit }), resolveAutomationStudioNodeActionEffect(node, { submit }));
  }
});

test("model fields cannot lower a press or invent permission consequence classes", () => {
  assert.deepEqual(webAutomationResolvedActionEffect("web.dom.click", {
    effect: "observe", actionEffect: { effectClass: "observe", permissionConsequences: [] }, idempotent: true,
    metadata: { effect: "observe" }, consequences: []
  }), { effectClass: "commit", permissionConsequences: [] });
  assert.equal(webAutomationResolvedActionEffect("unknown", {}), undefined);
});


test("actual native SDK registration retains all web floors through serialization and parameter resolution", () => {
  const manifest = createWebAutomationOutputNodeManifest();
  const runtime = new AutomationStudioNativeNodeRuntime().register(JSON.parse(JSON.stringify(structuredClone(manifest))), createWebAutomationOutputNodeImplementationBundle());
  for (const actionType of WEB_AUTOMATION_ACTION_TYPES) {
    const source = webAutomationOutputNodeDefinitions.find((item) => item.outputAction?.fixedOutputId === actionType);
    assert.ok(source);
    const definition = runtime.getDefinition(source.id);
    assert.ok(definition);
    assert.deepEqual(definition.actionEffect, source.actionEffect);
    assert.deepEqual(runtime.sdk.get(manifest.packageId)?.nodes.find((item) => item.id === source.id)?.actionEffect, source.actionEffect);
    for (const parameters of [{}, { submit: false }, { submit: true }, { submit: { $state: { path: "send", fallback: false } } }, { newTab: false }, { newTab: true }, { newTab: { $state: { path: "tab", fallback: false } } }]) {
      assert.deepEqual(resolveAutomationStudioNodeActionEffect(definition, parameters), webAutomationResolvedActionEffect(actionType, parameters));
      assert.deepEqual(runtime.resolveActionEffect({ id: "native", definitionId: definition.id, parameterValues: parameters }), webAutomationResolvedActionEffect(actionType, parameters));
    }
  }
});


test("same-tab navigation alone promises repeat safety; forced or unresolved newTab commits", () => {
  const node = webAutomationOutputNodeDefinitions.find((item) => item.outputAction?.fixedOutputId === "web.browser.navigate");
  assert.ok(node);
  assert.equal(node.parameters.find((parameter) => parameter.id === "newTab")?.defaultValue, false);
  for (const parameters of [{}, { newTab: false }]) {
    assert.deepEqual(webAutomationResolvedActionEffect("web.browser.navigate", parameters), { effectClass: "state", permissionConsequences: [], repeatSafe: true });
  }
  for (const newTab of [true, undefined, null, "false", { $state: { path: "tab", fallback: false } }]) {
    assert.deepEqual(webAutomationResolvedActionEffect("web.browser.navigate", { newTab }), { effectClass: "commit", permissionConsequences: [] });
    assert.deepEqual(webAutomationResolvedActionEffect("web.browser.navigate", { newTab }), resolveAutomationStudioNodeActionEffect(node, { newTab }));
  }
});
