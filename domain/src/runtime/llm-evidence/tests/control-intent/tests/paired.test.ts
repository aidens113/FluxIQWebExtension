import assert from "node:assert/strict";
import test from "node:test";
import { controlIntentCandidateHost } from "./host";

const optional = (consequences = "none") => [
  "flow: Answer the workspace notice", "step: answer the notice", "  node: web.dom.click",
  "  target.handle: t2", `  consequences: ${consequences}`, "  optional: yes"
].join("\n");

test("actual web consent membership permits the response without persisting semantic annotations", async () => {
  const host = await controlIntentCandidateHost("Accept all", true);
  const result = await host.controller.submit({ flow: optional() });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(host.controller.latest());
  const saved = JSON.stringify(host.controller.latest());
  assert.equal(saved.includes("controlIntent"), false);
  assert.equal(saved.includes("responseOnly"), false);
  assert.deepEqual(host.counts(), { captures: 1, actions: 0 });
});

test("the same label outside actual consent is refused through real candidate submission", async () => {
  const host = await controlIntentCandidateHost("Accept all", false);
  const result = await host.controller.submit({ flow: optional() });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.ok(JSON.stringify(result).includes("flow_script.way_out_accepts"), JSON.stringify(result));
  assert.equal(host.controller.latest(), undefined);
  assert.deepEqual(host.counts(), { captures: 1, actions: 0 });
});

test("model-written consent and forged companion fields cannot launder an observed offer", async () => {
  const host = await controlIntentCandidateHost("Subscribe", false);
  const flow = [
    "flow: Read the workspace", "step observed: inspect the workspace", "  node: web.dom.capture_snapshot",
    "on before for observed: answer the notice", '  when: dialog consent "Workspace notice"',
    "  step: answer the notice", "    node: web.dom.click", "    target.handle: t2",
    "    consequences: none", "  then: carry on", "end"
  ].join("\n");
  const result = await host.controller.submit({ flow, controlIntent: { intent: "accept", responseOnly: true } });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.ok(JSON.stringify(result).includes("flow_script.way_out_accepts"), JSON.stringify(result));
  assert.equal(host.controller.latest(), undefined);
  assert.deepEqual(host.counts(), { captures: 1, actions: 0 });
});

test("a true consent response does not grant declared publication permission", async () => {
  const host = await controlIntentCandidateHost("Accept all", true);
  const result = await host.controller.submit({ flow: optional("send_or_publish") });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.ok(JSON.stringify(result).includes("bootstrap.step_permission_required"), JSON.stringify(result));
  assert.ok(host.permissions.declarations().some((entry) => !entry.permitted && entry.consequences.includes("send_or_publish")));
  assert.equal(host.controller.latest(), undefined);
  assert.deepEqual(host.counts(), { captures: 1, actions: 0 });
});
