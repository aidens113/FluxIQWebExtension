import assert from "node:assert/strict";
import test from "node:test";
import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { selectCoreProbeStep } from "../probe-step.js";

/** modal-flows' primary script (W12): the email field is inside a dialog the first click opens. */
const inviteScript: ScenarioStep[] = [
  { id: "open-invite", operation: "click", target: "testid:open-invite" },
  { id: "enter-email", operation: "type", target: "testid:invite-email", value: "someone@example.test" },
  { id: "choose-role", operation: "select", target: "testid:invite-role", value: "editor" },
  { id: "invite-sent", operation: "checkpoint" },
];

function startPage(visible: readonly string[]) {
  const asked: string[] = [];
  return { asked, onStartPage: async (selector: string) => { asked.push(selector); return visible.includes(selector); } };
}

test("a type step whose target only an earlier step reveals is skipped, naming the reason and the step", async () => {
  const page = startPage(['[data-testid="open-invite"]']);
  assert.deepEqual(await selectCoreProbeStep(inviteScript, page.onStartPage), { kind: "skipped", reason: "not-on-start-page", stepIds: ["enter-email"] });
  assert.deepEqual(page.asked, ['[data-testid="invite-email"]'], "the start page is asked about the type step's own selector");
});

test("the probe types into the first type step, in script order, whose target is on the start page", async () => {
  const script: ScenarioStep[] = [...inviteScript, { id: "enter-note", operation: "type", target: "#note", value: "note" }];
  const later = await selectCoreProbeStep(script, startPage(["#note"]).onStartPage);
  assert.equal(later.kind === "probe" ? `${later.step.id} ${later.selector}` : later.kind, "enter-note #note");
  const first = await selectCoreProbeStep(script, startPage(['[data-testid="invite-email"]', "#note"]).onStartPage);
  assert.equal(first.kind === "probe" ? first.step.id : first.kind, "enter-email");
});

test("a script with no type step that has a CSS target is skipped without asking the page", async () => {
  const page = startPage([]);
  const noType = await selectCoreProbeStep([{ id: "open", operation: "click", target: "testid:open" }], page.onStartPage);
  const roleOnly = await selectCoreProbeStep([{ id: "name", operation: "type", target: "role:textbox:Name", value: "Ada" }], page.onStartPage);
  assert.deepEqual([noType, roleOnly], [{ kind: "skipped", reason: "no-css-type-step", stepIds: [] }, { kind: "skipped", reason: "no-css-type-step", stepIds: [] }]);
  assert.deepEqual(page.asked, []);
});
