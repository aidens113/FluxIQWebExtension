import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { modalFlowsClientScript } from "../client-script.js";
import { modalFlowsScenario } from "../scenario.js";
import type { ModalFlowsState } from "../state.js";

const { manifest } = modalFlowsScenario;
const fresh = (): ModalFlowsState => modalFlowsScenario.createState(42);
const apply = (state: ModalFlowsState, operation: string, payload: unknown = {}): ModalFlowsState => modalFlowsScenario.mutate(state, operation, payload);
const render = (state: ModalFlowsState): string => modalFlowsScenario.render(state, { runToken: "modal-flows-unit-token", seed: 42 });
const invite = { email: "ada@example.test", role: "editor" };

test("manifest is valid: W12 primary, W13 consent-then-click, W14 interstitial, one variant each", () => {
  assert.deepEqual(validateWebScenario(manifest), { valid: true, value: manifest });
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.deepEqual(manifest.recordingScript.map((step) => step.id), ["open-invite", "enter-email", "choose-role", "confirm-invite", "invite-sent"]);
  assert.deepEqual(manifest.workflows?.map((workflow) => [workflow.id, workflow.variants?.map((variant) => variant.id)]), [["consent-then-click", ["banner-absent"]], ["interstitial", ["armed"]]]);
  const consent = resolveScenarioWorkflow(manifest, { workflowId: "consent-then-click" });
  const bannerAbsent = resolveScenarioWorkflow(manifest, { workflowId: "consent-then-click", variantId: "banner-absent" });
  assert.equal(bannerAbsent.expected.failure, undefined);
  assert.deepEqual(bannerAbsent.expected.finalState, consent.expected.finalState);
  const armed = resolveScenarioWorkflow(manifest, { workflowId: "interstitial", variantId: "armed" });
  assert.deepEqual(armed.expected.failure, { category: "user_intervention_required" });
  assert.deepEqual(armed.recordingScript.map((step) => step.target), ["testid:add-section", "testid:add-section", undefined]);
});

test("state is deterministic from the seed", () => {
  assert.deepEqual(fresh(), {
    draftTitle: "Community digest", consent: "pending", invites: [], inviteCancellations: 0, publishCount: 0,
    sectionCount: 0, interstitial: "unarmed", draft: "active", deletePrompts: { accepted: 0, dismissed: 0 },
  });
  assert.deepEqual(modalFlowsScenario.createState(42), fresh());
  assert.equal(modalFlowsScenario.createState(117).draftTitle, "Quarterly roadmap");
  assert.equal(modalFlowsScenario.createState(-3).draftTitle, "Release notes");
  assert.equal(render(fresh()), render(fresh()));
});

test("send-invite records a valid invitation and ignores malformed payloads", () => {
  assert.deepEqual(apply(fresh(), "send-invite", invite), { ...fresh(), invites: [invite] });
  for (const payload of [null, "ada@example.test", {}, { email: "ada", role: "editor" }, { email: "ada@example.test", role: "owner" }, { email: "<b>@example.test", role: "viewer" }]) {
    assert.deepEqual(apply(fresh(), "send-invite", payload), fresh());
  }
});

test("cancel-invite counts cancellations and sends nothing", () => {
  assert.deepEqual(apply(apply(fresh(), "cancel-invite"), "cancel-invite"), { ...fresh(), inviteCancellations: 2 });
});

test("accept-cookies and reject-cookies decide a pending banner once", () => {
  const accepted = apply(fresh(), "accept-cookies");
  assert.deepEqual(accepted, { ...fresh(), consent: "accepted" });
  assert.deepEqual(apply(accepted, "reject-cookies"), accepted);
  assert.deepEqual(apply(fresh(), "reject-cookies"), { ...fresh(), consent: "essential-only" });
});

test("remove-consent-banner arms banner-absent and changes only the banner", () => {
  assert.deepEqual(manifest.workflows?.[0]?.variants?.[0]?.arm, { operation: "remove-consent-banner" });
  const armed = apply(fresh(), "remove-consent-banner");
  assert.deepEqual(armed, { ...fresh(), consent: "absent" });
  assert.deepEqual(apply(armed, "accept-cookies"), armed);
  assert.equal(apply(apply(fresh(), "accept-cookies"), "remove-consent-banner").consent, "absent");
});

test("publish counts clicks on the primary action", () => {
  assert.deepEqual(apply(apply(fresh(), "publish"), "publish"), { ...fresh(), publishCount: 2 });
});

test("add-section counts sections and leaves an unarmed interstitial alone", () => {
  assert.deepEqual(apply(apply(fresh(), "add-section"), "add-section"), { ...fresh(), sectionCount: 2 });
});

test("arm-interstitial opens the offer after the first add and blocks the page until closed", () => {
  assert.deepEqual(manifest.workflows?.[1]?.variants?.[0]?.arm, { operation: "arm-interstitial" });
  const armed = apply(fresh(), "arm-interstitial");
  assert.deepEqual(armed, { ...fresh(), interstitial: "armed" });
  const open = apply(armed, "add-section");
  assert.deepEqual(open, { ...fresh(), sectionCount: 1, interstitial: "open" });
  const pageOperations: Array<[string, unknown]> = [["add-section", {}], ["publish", {}], ["accept-cookies", {}], ["send-invite", invite], ["cancel-invite", {}], ["delete-draft", { confirmed: true }]];
  for (const [operation, payload] of pageOperations) assert.deepEqual(apply(open, operation, payload), open, operation);
  const closed = apply(open, "close-interstitial");
  assert.deepEqual(closed, { ...open, interstitial: "closed" });
  assert.deepEqual(apply(closed, "add-section"), { ...closed, sectionCount: 2 });
  assert.deepEqual(apply(fresh(), "close-interstitial"), fresh());
});

test("delete-draft follows the native confirm() answer", () => {
  const kept = apply(fresh(), "delete-draft", { confirmed: false });
  assert.deepEqual(kept, { ...fresh(), deletePrompts: { accepted: 0, dismissed: 1 } });
  const deleted = apply(kept, "delete-draft", { confirmed: true });
  assert.deepEqual(deleted, { ...fresh(), draft: "deleted", deletePrompts: { accepted: 1, dismissed: 1 } });
  assert.deepEqual(apply(deleted, "delete-draft", { confirmed: true }), deleted);
  assert.deepEqual(apply(fresh(), "delete-draft", {}), fresh());
});

test("unknown operations leave the state unchanged", () => {
  assert.deepEqual(apply(fresh(), "open-invite"), fresh());
});

test("render: labelled modal dialog, banner only while pending, offer only when due", () => {
  const initial = render(fresh());
  assert.match(initial, /role="dialog" aria-modal="true" aria-labelledby="invite-heading"/);
  assert.match(initial, /data-testid="consent-banner"/);
  assert.doesNotMatch(initial, /data-testid="interstitial"/);
  assert.doesNotMatch(render(apply(fresh(), "accept-cookies")), /data-testid="consent-banner"/);
  assert.doesNotMatch(render(apply(fresh(), "remove-consent-banner")), /data-testid="consent-banner"/);
  assert.match(render(apply(fresh(), "arm-interstitial")), /<template id="interstitial-template">/);
  const open = render(apply(apply(fresh(), "arm-interstitial"), "add-section"));
  assert.match(open, /data-testid="page-shell" inert/);
  assert.match(open, /<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="offer-heading"/);
  assert.doesNotMatch(open, /<template/);
  assert.match(render(apply(fresh(), "send-invite", { email: "a&b@example.test", role: "viewer" })), /Invitation sent to a&amp;b@example\.test \(Viewer\)/);
});

test("the page script parses and embeds the shared page logic", () => {
  const script = modalFlowsClientScript("modal-flows-unit-token", fresh());
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /inviteResult: \(invite\) =>/);
});

test("the fixture serves no documents beyond its start page", () => {
  assert.equal(modalFlowsScenario.route, undefined);
});
