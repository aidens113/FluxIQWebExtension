import assert from "node:assert/strict";
import test from "node:test";
import { validateWebScenario } from "@fluxiq-web-extension/test-contracts";
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
