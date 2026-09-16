import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { PLANTED_UNLOCK_CODE, savedCards } from "../saved-cards.js";
import { sensitiveInputScenario } from "../scenario.js";

const { createState, render, manifest } = sensitiveInputScenario;
const page = render(createState(110), { runToken: "sensitive-input-token", seed: 110 });

/** The opening tag of the form control a `testid:` target names; undefined for any other target. */
function formControlTag(target: string): string | undefined {
  if (!target.startsWith("testid:")) return undefined;
  const id = target.slice("testid:".length);
  return [...page.matchAll(/<(?:input|textarea|select)\b[^>]*>/gu)].map(match => match[0]).find(tag => tag.includes(` data-testid="${id}"`));
}

/**
 * The markings `domain/src/sensitivity/signature.ts` reads, restated because
 * scenario-lab depends only on test-contracts and cannot import the domain.
 * The test below also pins the marked steps by name, so this copy drifting
 * from the rule fails there rather than passing quietly.
 */
function isMarkedSensitive(tag: string): boolean {
  const attribute = (name: string): string => (new RegExp(`\\s${name}="([^"]*)"`, "u").exec(tag)?.[1] ?? "").trim().toLowerCase();
  if (["password", "one-time-code", "credit-card"].includes(attribute("type")) || attribute("data-sensitive") === "true") return true;
  return attribute("autocomplete").split(/\s+/u).some(token => ["current-password", "new-password", "one-time-code"].includes(token) || token.startsWith("cc-"));
}

test("manifest is valid", () => {
  assert.deepEqual(validateWebScenario(manifest), { valid: true, value: manifest });
});

test("a secret is declared for exactly the steps that type into a marked control, each one pairable by its test id", () => {
  const steps = manifest.recordingScript;
  const marked = steps.filter(step => {
    const tag = step.target === undefined ? undefined : formControlTag(step.target);
    // A typed step must name its control by test id: that is what the Flow
    // lane pairs a declaration against, and a password input has no role.
    if (step.operation === "type") assert.ok(tag, `${step.id} types into a form control the page renders, named by test id`);
    return tag !== undefined && isMarkedSensitive(tag);
  });
  // Only typed text becomes a request (`domain/src/output-nodes/payloads.ts`).
  assert.deepEqual(marked.filter(step => step.operation !== "type").map(step => step.id), []);
  assert.deepEqual(marked.map(step => step.id), ["replace-password", "replace-payment"]);
  const secrets = manifest.secrets ?? [];
  assert.deepEqual(secrets.map(secret => secret.step), marked.map(step => step.id), "one declaration per marked step, and none for any other");
  const targets = secrets.map(secret => steps.find(step => step.id === secret.step)?.target ?? "");
  for (const target of targets) assert.match(target, /^testid:[a-z0-9-]+$/u);
  assert.equal(new Set(targets).size, targets.length, "no two declarations name the same control");
  assert.equal(new Set(secrets.map(secret => secret.id.replaceAll("-", "_").toUpperCase())).size, secrets.length, "each value has its own variable");
  // The billing card is marked too, but no step types into it, so nothing asks for it.
  const billing = formControlTag("testid:billing");
  assert.ok(billing);
  assert.equal(isMarkedSensitive(billing), true);
  assert.equal(steps.some(step => step.target === "testid:billing"), false);
});

test("the saved cards are a repeating structure whose every item holds visible text and a password control", () => {
  assert.equal((page.match(/<li data-testid="card-row">/gu) ?? []).length, savedCards.length);
  assert.match(page, /<ul data-testid="saved-cards">/u);
  for (const card of savedCards) {
    assert.ok(page.includes(`<span data-testid="card-label">${card.label}</span>`), card.label);
    assert.ok(page.includes(`<span data-testid="card-expiry">${card.expiry}</span>`), card.expiry);
    assert.ok(page.includes(`value="${card.unlockCode}"`), `${card.id} plants its unlock code on the page`);
  }
  // The refusal must come from the shared signature rule, not from anything
  // this fixture declares about itself, so the control carries type=password.
  const control = formControlTag("testid:card-unlock-code");
  assert.ok(control);
  assert.equal(isMarkedSensitive(control), true);
  assert.match(control, /type="password"/u);
  assert.equal(new Set(savedCards.map(card => card.unlockCode)).size, savedCards.length, "each code is distinct, so a leak names the card it came from");
});

test("extract-card-secrets reads the password control and expects the refusal, returning no records at all", () => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "extract-card-secrets" });
  const step = workflow.recordingScript.find(({ operation }) => operation === "extract");
  assert.equal(step?.target, "testid:card-row");
  assert.equal(step?.fields?.code, "testid:card-unlock-code@value");
  assert.deepEqual(workflow.expected.failure, { category: "blocked_by_capability_or_policy", code: "web.action.rejected" });
  // A refused read returns nothing, so there is no count or record list to meet.
  assert.equal(workflow.expected.extracted, undefined);
  // An extract step records no action, so no `actions` entry could ever be met.
  assert.equal(workflow.expected.actions, undefined);
});

test("extract-card-labels leaves the code out entirely rather than masking it, and succeeds", () => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "extract-card-labels" });
  const step = workflow.recordingScript.find(({ operation }) => operation === "extract");
  assert.deepEqual(step?.fields, { label: "testid:card-label", expiry: "testid:card-expiry" });
  assert.ok(!Object.values(step?.fields ?? {}).some(selector => selector.includes("card-unlock-code")), "an excluded column is never read");
  assert.deepEqual(workflow.expected.extracted, [{
    step: "extract-cards", count: savedCards.length,
    records: savedCards.map(({ label, expiry }) => ({ label, expiry })),
  }]);
  assert.equal(workflow.expected.failure, undefined);
  // Excluded, not masked: the key is absent from every record, not present with a placeholder.
  for (const record of workflow.expected.extracted?.[0]?.records ?? []) {
    assert.deepEqual(Object.keys(record), ["label", "expiry"]);
  }
});

test("no expectation in the manifest quotes a planted unlock code, though the page carries one", () => {
  // The page-side half of the bundle scan: the string is genuinely on the page,
  // so a bundle that contains it has taken it from a sensitive control rather
  // than from a fixture that never planted it.
  assert.ok(page.includes(PLANTED_UNLOCK_CODE), "the planted code is on the page for a run to leak");
  assert.ok(!JSON.stringify(manifest).includes(PLANTED_UNLOCK_CODE), "no expectation may quote a sensitive control's value");
  assert.ok(!JSON.stringify(manifest.workflows ?? []).includes(PLANTED_UNLOCK_CODE));
});
