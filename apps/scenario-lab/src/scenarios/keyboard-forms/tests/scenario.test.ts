import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { keyboardFormsScenario } from "../scenario.js";

const { createState, mutate, render, manifest } = keyboardFormsScenario;
const context = { runToken: "keyboard-forms-token", seed: 123 };
const initialState = {
  profile: { displayName: "", outcome: "unsaved", submissionCount: 0, lastSubmitter: null },
  preferences: { emailUpdates: false, contactMethod: "email", country: null },
  status: { profile: "Not saved", emailUpdates: "Email updates: off", contactMethod: "Contact method: Email", country: "Country: not set" },
};

test("manifest is valid, loopback-only, and holds the W02 primary and W03 combobox workflows without variants", () => {
  assert.deepEqual(validateWebScenario(manifest), { valid: true, value: manifest });
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.deepEqual([manifest.id, manifest.seed, manifest.startPath], ["keyboard-forms", 123, "/scenarios/keyboard-forms/"]);
  assert.deepEqual(manifest.recordingScript.map(step => [step.operation, step.value ?? null]), [
    ["type", "Ada Lovelace"], ["press", "Enter"], ["check", true], ["check", true], ["checkpoint", null],
  ]);
  assert.deepEqual(manifest.workflows?.map(workflow => workflow.id), ["combobox"]);
  assert.equal(manifest.variants, undefined);
  assert.equal(manifest.workflows?.[0]?.variants, undefined);
  const combobox = resolveScenarioWorkflow(manifest, { workflowId: "combobox" });
  assert.deepEqual(combobox.recordingScript.map(step => [step.operation, step.value ?? null]), [
    ["type", "Ne"], ["press", "ArrowDown"], ["waitForState", null], ["press", "ArrowDown"], ["press", "Enter"], ["checkpoint", null],
  ]);
  assert.deepEqual(combobox.expected.recordingEvents?.find(event => event.type === "web.form.submitted"), { type: "web.form.submitted", count: 0 });
  assert.deepEqual(resolveScenarioWorkflow(manifest).expected.recordingEvents?.find(event => event.type === "web.form.submitted"), { type: "web.form.submitted", count: 1 });
});

test("every step target and fact subject names a data-testid the start page renders", () => {
  const html = render(createState(123), context);
  for (const workflow of [resolveScenarioWorkflow(manifest), resolveScenarioWorkflow(manifest, { workflowId: "combobox" })]) {
    for (const step of workflow.recordingScript) {
      if (step.target === undefined) continue;
      assert.ok(step.target.startsWith("testid:"), step.id);
      assert.match(html, new RegExp(`data-testid="${step.target.slice("testid:".length)}"`), step.id);
    }
    for (const fact of [...(workflow.expected.pageFacts ?? []), ...(workflow.expected.finalState ?? [])]) {
      assert.match(html, new RegExp(`data-testid="${fact.subject}"`), fact.id);
    }
  }
});

test("state and markup are deterministic and independent of the seed", () => {
  assert.deepEqual(createState(123), initialState);
  assert.deepEqual(createState(42), createState(123));
  assert.equal(render(createState(42), context), render(createState(42), context));
});

test("save-profile accepts a trimmed, bounded name, records the submitter, and rejects an empty name", () => {
  const initial = createState(123);
  const saved = mutate(initial, "save-profile", { displayName: "  Ada Lovelace  ", submitter: "save-profile" });
  assert.deepEqual(saved.profile, { displayName: "Ada Lovelace", outcome: "saved", submissionCount: 1, lastSubmitter: "save-profile" });
  assert.equal(saved.status.profile, "Saved: Ada Lovelace");
  assert.deepEqual(saved.preferences, initialState.preferences);
  assert.equal(mutate(saved, "save-profile", { displayName: "Grace Hopper", submitter: null }).profile.lastSubmitter, null);
  assert.equal(mutate(saved, "save-profile", { displayName: "Grace Hopper", submitter: "elsewhere" }).profile.lastSubmitter, null);
  const rejected = mutate(saved, "save-profile", { displayName: "   " });
  assert.deepEqual(rejected.profile, { displayName: "Ada Lovelace", outcome: "rejected", submissionCount: 2, lastSubmitter: null });
  assert.equal(rejected.status.profile, "Display name is required");
  assert.equal(mutate(initial, "save-profile", {}).profile.outcome, "rejected");
  assert.equal(mutate(initial, "save-profile", { displayName: "x".repeat(200) }).profile.displayName.length, 80);
  assert.deepEqual(initial, initialState);
});

test("checkbox, radio group, and combobox operations each set one preference", () => {
  const initial = createState(123);
  const updates = mutate(initial, "set-email-updates", { enabled: true });
  assert.deepEqual(updates.preferences, { ...initialState.preferences, emailUpdates: true });
  assert.equal(updates.status.emailUpdates, "Email updates: on");
  assert.equal(mutate(updates, "set-email-updates", { enabled: false }).status.emailUpdates, "Email updates: off");
  const sms = mutate(initial, "set-contact-method", { method: "sms" });
  assert.deepEqual(sms.preferences, { ...initialState.preferences, contactMethod: "sms" });
  assert.equal(sms.status.contactMethod, "Contact method: Text message");
  assert.equal(mutate(initial, "set-contact-method", { method: "phone" }).status.contactMethod, "Contact method: Phone call");
  const netherlands = mutate(initial, "choose-country", { code: "NL" });
  assert.deepEqual(netherlands.preferences, { ...initialState.preferences, country: "NL" });
  assert.equal(netherlands.status.country, "Country: Netherlands");
  assert.deepEqual(netherlands.profile, initialState.profile);
  assert.deepEqual(initial, initialState);
});

test("invalid payloads and unknown operations leave the state untouched", () => {
  const initial = createState(123);
  const rejected: Array<[string, unknown]> = [
    ["set-email-updates", { enabled: "yes" }], ["set-contact-method", { method: "fax" }], ["choose-country", { code: "XX" }],
    ["choose-country", { code: "nl" }], ["save-profile", null], ["save-profile", "Ada"], ["save-profile", ["Ada"]], ["unknown", { code: "NL" }],
  ];
  for (const [operation, payload] of rejected) assert.equal(mutate(initial, operation, payload), initial, operation);
});

test("the page renders a native form, a labelled checkbox and radio group, and an ARIA combobox", () => {
  const html = render(createState(123), context);
  assert.match(html, /<form data-testid="settings-form" aria-labelledby="settings-heading">/);
  assert.match(html, /<label for="display-name">Display name<\/label>/);
  assert.match(html, /<button type="submit" data-testid="save-profile">Save profile<\/button>/);
  assert.match(html, /<input type="checkbox" name="emailUpdates" data-testid="email-updates"> Email me product updates<\/label>/);
  assert.match(html, /<legend>Preferred contact method<\/legend>/);
  assert.match(html, /value="email" data-testid="contact-email" checked> Email<\/label>/);
  assert.match(html, /role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="country-listbox" autocomplete="off" data-testid="country" value="">/);
  assert.match(html, /<ul id="country-listbox" role="listbox" aria-labelledby="country-label" data-testid="country-listbox" hidden>/);
  assert.equal(html.match(/<li id="country-option-/g)?.length, 12);
  assert.match(html, /<li id="country-option-nl" role="option" aria-selected="false" data-value="NL" data-testid="country-option-nl">Netherlands<\/li>/);
  assert.match(html, /data-testid="profile-status">Not saved</);
});

test("the client script reacts to untrusted events, relies on native submission, and uses no clock or randomness", () => {
  const html = render(createState(123), context);
  assert.doesNotMatch(html, /isTrusted/);
  assert.doesNotMatch(html, /requestSubmit/);
  assert.doesNotMatch(html, /Math\.random|Date\.now|new Date|setTimeout|setInterval/);
  assert.match(html, /addEventListener\('submit'/);
  assert.match(html, /combobox\.addEventListener\('keydown'/);
  assert.match(html, /combobox\.addEventListener\('input', applyFilter\)/);
});

test("the page reflects saved state and escapes the display name", () => {
  let state = mutate(createState(123), "save-profile", { displayName: "<Ada & Co>", submitter: "save-profile" });
  state = mutate(state, "set-email-updates", { enabled: true });
  state = mutate(state, "set-contact-method", { method: "phone" });
  state = mutate(state, "choose-country", { code: "NZ" });
  const html = render(state, context);
  assert.match(html, /data-testid="display-name" value="&lt;Ada &amp; Co&gt;">/);
  assert.match(html, /data-testid="profile-status">Saved: &lt;Ada &amp; Co&gt;</);
  assert.match(html, /data-testid="email-updates" checked>/);
  assert.match(html, /data-testid="contact-phone" checked>/);
  assert.doesNotMatch(html, /data-testid="contact-email" checked/);
  assert.match(html, /data-testid="country" value="New Zealand">/);
  assert.match(html, /data-testid="country-status">Country: New Zealand</);
});

test("the fixture serves only its start page: it has no route hook", () => {
  assert.equal(keyboardFormsScenario.route, undefined);
});
