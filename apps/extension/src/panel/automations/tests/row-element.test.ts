import assert from "node:assert/strict";
import test from "node:test";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { AutomationRowView } from "../controller";
import { automationRowElement } from "../row-element";

const row: AutomationRowView = { flowId: "flow-a", name: "Orders", lines: ["Not run yet"], datasets: [], running: false, stoppable: false, exporting: false };

test("row updates retain the li/button/text nodes and choose the entire latest view", async () => withFakeDocument(() => {
  const chosen: AutomationRowView[] = [];
  const mounted = automationRowElement(row, (next) => chosen.push(next));
  const button = fake(mounted.button);
  const name = button.byClass("automation-row-name")[0]!;
  const line = button.byClass("automation-row-line")[0]!;
  const next: AutomationRowView = { ...row, name: "New orders", lines: ["Running..."], running: true, stoppable: true, exporting: true, runId: "run-new", datasets: [{ datasetId: "data-new", label: "Orders" }] };
  mounted.update(next);
  assert.equal(fake(mounted).children[0], button);
  assert.equal(button.byClass("automation-row-name")[0], name);
  assert.equal(button.byClass("automation-row-line")[0], line);
  assert.equal(name.textContent, next.name);
  assert.equal(line.textContent, "Running...");
  assert.equal(button.getAttribute("title"), "Open New orders in the chat");
  button.dispatch("click");
  assert.equal(chosen[0], next, "latest data, including run/export/datasets, reaches the existing handler");
}));

test("empty summary clears old text, untrusted names remain text, and listener is not duplicated", async () => withFakeDocument(() => {
  let clicks = 0;
  const mounted = automationRowElement(row, () => clicks++);
  mounted.update({ ...row, name: "<script>never markup</script>", lines: [] });
  mounted.update({ ...row, name: "<script>never markup</script>", lines: [] });
  const button = fake(mounted.button);
  assert.equal(button.byClass("automation-row-name")[0]?.textContent, "<script>never markup</script>");
  assert.equal(button.byClass("automation-row-line")[0]?.textContent, "");
  assert.equal(button.listeners.get("click")?.length, 1);
  button.dispatch("click");
  assert.equal(clicks, 1);
}));
