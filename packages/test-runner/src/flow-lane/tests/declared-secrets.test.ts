import assert from "node:assert/strict";
import test from "node:test";
import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { declaredSecretBindingInputs, declaredSecretEnvironmentName, declaredSecretValues, flowSecretRequests, resolveDeclaredSecrets, type FlowSecretRequest, type SecretDeclaringScenario } from "../declared-secrets.js";
import { readFlowNodes } from "../flow-action-types.js";
import { RunnerFailure } from "../../failure.js";
import type { RecordingProposalControl } from "../recording-flow-proposal.js";

/**
 * Shaped like auth-gate, the one scenario that declares a secret: a recorded
 * password step, and a declaration naming it. `RECORDED` stands for whatever
 * the recording holds for that step; nothing may ever resolve to it.
 */
const RECORDED = "value-the-recording-holds";
const scenario: SecretDeclaringScenario = {
  id: "auth-gate",
  recordingScript: [
    { id: "enter-username", operation: "type", target: "testid:username", value: "demo.user" },
    { id: "enter-password", operation: "type", target: "testid:password", value: RECORDED },
    { id: "submit-sign-in", operation: "click", target: "testid:sign-in" },
  ],
  secrets: [{ id: "auth-gate-password", step: "enter-password" }],
};

test("a secret id becomes an upper-case environment variable name", () => {
  assert.equal(declaredSecretEnvironmentName("auth-gate-password"), "FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD");
  assert.equal(declaredSecretEnvironmentName("totp"), "FLUXIQ_TEST_SECRET_TOTP");
});

test("declared secrets take their value from the environment, never from the recording", () => {
  const resolved = resolveDeclaredSecrets(scenario, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "supplied-at-replay" });
  assert.deepEqual(resolved, [{ id: "auth-gate-password", step: "enter-password", value: "supplied-at-replay" }]);
  assert.deepEqual(declaredSecretValues(resolved), ["supplied-at-replay"]);
  // The declaration names the recorded step, so the recorded value is in
  // reach; the resolver must still never be the thing that reaches for it.
  assert.equal(JSON.stringify(resolved).includes(RECORDED), false);
});

test("an undeclared or unset secret fails closed rather than falling back to the recorded value", () => {
  assert.throws(
    () => resolveDeclaredSecrets(scenario, {}),
    (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD/.test(error.message),
  );
  assert.throws(() => resolveDeclaredSecrets(scenario, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "" }), /must be set/);
  // The value is absent, so the recorded one must not be substituted anywhere:
  // an empty variable yields no secret at all rather than an empty-valued one.
  try { resolveDeclaredSecrets(scenario, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "" }); }
  catch (error) { assert.equal(JSON.stringify((error as RunnerFailure).details ?? {}).includes(RECORDED), false); }
});

/**
 * The failure a declaration typo would otherwise become: an input keyed by a
 * secret nothing recorded, while the step it was meant to replace keeps
 * whatever the recording holds. Inert wiring is what this plan keeps finding,
 * so a declaration that names no recorded step is a run failure.
 */
test("a declaration that names no recorded step fails the run instead of resolving to nothing", () => {
  const stale = { ...scenario, secrets: [{ id: "auth-gate-password", step: "enter-passphrase" }] };
  assert.throws(
    () => resolveDeclaredSecrets(stale, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "supplied-at-replay" }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid" && /enter-passphrase/.test(error.message),
  );
  // A step recorded by a further workflow rather than the primary script counts.
  const workflow = { ...stale, workflows: [{ id: "second", description: "another workflow", recordingScript: [{ id: "enter-passphrase", operation: "type" as const, target: "testid:passphrase" }], expected: {} }] };
  assert.deepEqual(resolveDeclaredSecrets(workflow, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "supplied-at-replay" }).map(secret => secret.step), ["enter-passphrase"]);
});

test("a scenario declaring no secret resolves to none", () => {
  assert.deepEqual(resolveDeclaredSecrets({ id: "basic-form", recordingScript: [] }, {}), []);
  assert.deepEqual(resolveDeclaredSecrets({ ...scenario, secrets: [] }, {}), []);
});

// -- Pairing a declaration with the request its node makes --------------------
// A node on a sensitive control carries `{ $state: { path } }` in place of the
// value. The declared value has to reach the run under that path, and the
// pairing is by control: the declared step's target against the identity the
// node recorded. `SUPPLIED` is the declared value; no failure may carry it.

const SUPPLIED = "supplied-at-replay";
const passwordSecret = { id: "auth-gate-password", step: "enter-password", value: SUPPLIED };
const passwordRequest: FlowSecretRequest = { nodeId: "node.password", parameter: "text", path: "web.secret.password", selector: "#password", element: { testId: "password", attributes: { "data-testid": "password" } } };
const steps = scenario.recordingScript;

function assertPairingFailure(run: () => unknown, mentions: readonly string[]): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof RunnerFailure, "a RunnerFailure");
    assert.equal(error.category, "fixture.invalid");
    for (const text of mentions) assert.ok(error.message.includes(text), `the failure names ${text}: ${error.message}`);
    assert.equal(JSON.stringify({ message: error.message, details: error.details }).includes(SUPPLIED), false, "the failure never carries a value");
    return true;
  });
}

test("a declared secret answers its control's request under the path the node asks for", () => {
  assert.deepEqual(declaredSecretBindingInputs({ scenarioId: "auth-gate", secrets: [passwordSecret], steps, requests: [passwordRequest] }), { "web.secret.password": SUPPLIED });
  // Two nodes on the same control ask under the same path: one request, one answer.
  assert.deepEqual(
    declaredSecretBindingInputs({ scenarioId: "auth-gate", secrets: [passwordSecret], steps, requests: [passwordRequest, { ...passwordRequest, nodeId: "node.password-again" }] }),
    { "web.secret.password": SUPPLIED },
  );
  // A frame target compares its inner target; a role target its role and name.
  const cardSteps: ScenarioStep[] = [
    { id: "enter-card-number", operation: "type", target: "frame:Secure card payment/testid:card-number" },
    { id: "enter-pin", operation: "type", target: "role:textbox:PIN" },
  ];
  assert.deepEqual(
    declaredSecretBindingInputs({
      scenarioId: "storefront",
      secrets: [{ id: "card", step: "enter-card-number", value: "card-sentinel" }, { id: "pin", step: "enter-pin", value: "pin-sentinel" }],
      steps: cardSteps,
      requests: [
        { nodeId: "node.card", parameter: "text", path: "web.secret.card-number", selector: "#card-number", element: { attributes: { "data-testid": "card-number" } } },
        { nodeId: "node.pin", parameter: "text", path: "web.secret.pin", selector: "#pin", element: { implicitRole: "textbox", accessibleName: "PIN" } },
      ],
    }),
    { "web.secret.card-number": "card-sentinel", "web.secret.pin": "pin-sentinel" },
  );
  assert.deepEqual(declaredSecretBindingInputs({ scenarioId: "basic-form", secrets: [], steps: [], requests: [] }), {});
});

test("a test-id declaration pairs with a node naming the control by that target's own CSS form, and no looser form", () => {
  // How a Flow FluxIQ built from an instruction names the control: a selector, and no recorded element.
  const built: FlowSecretRequest = { nodeId: "node.built", parameter: "text", path: "web.secret.password", selector: "[data-testid=\"password\"]", element: undefined };
  assert.deepEqual(declaredSecretBindingInputs({ scenarioId: "auth-gate", secrets: [passwordSecret], steps, requests: [built] }), { "web.secret.password": SUPPLIED });
  for (const selector of ["[data-testid='password']", "input[data-testid=\"password\"]", "#password"]) {
    assertPairingFailure(() => declaredSecretBindingInputs({ scenarioId: "auth-gate", secrets: [passwordSecret], steps, requests: [{ ...built, selector }] }), ["web.secret.password", "auth-gate-password"]);
  }
});

test("a request no declaration answers fails the run, naming the path and never a value", () => {
  assertPairingFailure(() => declaredSecretBindingInputs({ scenarioId: "auth-gate", secrets: [], steps, requests: [passwordRequest] }), ["web.secret.password", "parameter text"]);
});

test("a declaration that pairs with no request, or with several, fails the run", () => {
  // The step's control made no request: the recorder captured it, or the step never became a node.
  assertPairingFailure(() => declaredSecretBindingInputs({ scenarioId: "auth-gate", secrets: [passwordSecret], steps, requests: [] }), ["auth-gate-password", "enter-password"]);
  // Two different paths on the control the declaration names: which one it answers would be a guess.
  assertPairingFailure(
    () => declaredSecretBindingInputs({ scenarioId: "auth-gate", secrets: [passwordSecret], steps, requests: [passwordRequest, { ...passwordRequest, nodeId: "node.other", path: "web.secret.password-2" }] }),
    ["auth-gate-password", "paired with 2 requests"],
  );
  // Two declarations naming the same control: the request would be answered twice.
  assertPairingFailure(
    () => declaredSecretBindingInputs({ scenarioId: "auth-gate", secrets: [passwordSecret, { ...passwordSecret, id: "auth-gate-password-copy" }], steps, requests: [passwordRequest] }),
    ["web.secret.password", "answered by 2 declarations"],
  );
});

test("a declaration for a step this run did not record takes no part in the pairing", () => {
  const otherWorkflowSecret = { id: "passphrase", step: "enter-passphrase", value: "passphrase-sentinel" };
  assert.deepEqual(declaredSecretBindingInputs({ scenarioId: "auth-gate", secrets: [passwordSecret, otherWorkflowSecret], steps, requests: [passwordRequest] }), { "web.secret.password": SUPPLIED });
});

test("requests are read off the parent Flow and every Subflow graph, and a literal or other binding is none", async () => {
  const flows: Record<string, unknown> = {
    "flow.parent": { flow: { nodes: [{ id: "node.router", parameterValues: { outputId: "web.dom.click", parameters: { selector: "#go" } } }] } },
    "flow.graph": {
      flow: {
        nodes: [
          { id: "node.username", parameterValues: { outputId: "web.dom.type", parameters: { selector: "#username", text: "demo-user" } } },
          { id: "node.state", parameterValues: { outputId: "web.dom.type", parameters: { selector: "#state", text: { $state: { path: "web.elements.state" } } } } },
          { id: "node.password", parameterValues: { outputId: "web.dom.type", parameters: { selector: "#password", text: { $state: { path: "web.secret.password" } }, element: { testId: "password" } } } },
          { id: "node.unparameterized", parameterValues: { outputId: "web.dom.click" } },
        ],
      },
    },
  };
  const control: RecordingProposalControl = {
    automationStudioCall: async (endpoint, payload) => {
      if (endpoint === "get-flow") return flows[String(payload.flowId)];
      if (endpoint === "list-flow-subflows") return { subflows: [{ graphFlowId: "flow.parent" }, { graphFlowId: "flow.graph" }] };
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  };
  // The lane's single read of the Flow, then the requests derived from its nodes.
  assert.deepEqual(flowSecretRequests(await readFlowNodes(control, { projectId: "project.web", flowId: "flow.parent" })), [
    { nodeId: "node.password", parameter: "text", path: "web.secret.password", selector: "#password", element: { testId: "password" } },
  ]);
});
