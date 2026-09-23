// Live Chromium proof that a build can fill a form, and that the handles it was
// shown keep naming the same controls while it does.
//
// **This row was broken from 2026-09-22 to 2026-09-23 and nothing caught it.**
// It drove `web.press_control` and `web.enter_field`, two of the five invented
// exploration verbs task t082 retired when the model's calls and the Flow's
// nodes were made the same thing. Their ids stayed exported so a run recorded
// before that change still reads, so the file compiled; `executeTool` answers
// an unregistered tool with `web evidence tool is not registered`, so the row
// failed every time it ran. It is not in `pnpm check`, which is why nobody saw
// it. Rewritten here in the vocabulary that replaced them, and its claims
// rewritten with it:
//
// - **the entry itself** is now `core.run_node` naming `web.output.dom-type`
//   and `web.output.dom-select`, the same nodes the finished Flow runs, so what
//   this proves is a step that could ship rather than a verb nothing keeps;
// - **target stability** was `targetsUnchanged` on the tool's answer, which the
//   node path does not report and which no longer means what it did: a node
//   answers with the page it left behind, and every handle on it is restamped
//   so it keeps naming what it named. The claim is therefore made directly --
//   an entry is made with a handle read from an *earlier* packet, and the
//   handle each other field had is the handle it still has afterwards;
// - **the values never leave the page**: what was typed is not in the evidence,
//   and a control that holds a value says it has one without quoting it.

import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution
} from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";

const BASE = { projectId: "project.live-field-entry", flowId: "flow.live-field-entry", maxEvidenceBytes: 16_000 } as const;

/** The nodes this row runs, as the catalog names them; `core.run_node` takes the node's own parameters. */
const LOOK = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const TYPE = "web.output.dom-type";
const SELECT = "web.output.dom-select";

test("enters a live form's text and select fields through the Flow's own nodes, with handles that keep naming the same controls", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("social-scheduler");
  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({
        commandId: `live-field-entry.${++command}`,
        actionType: request.actionType,
        ...request.parameters
      } as Parameters<typeof harness.runAction>[0]);
      const snapshot = reply.snapshot === undefined ? undefined : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      return {
        status: reply.status,
        ...(snapshot ? { payload: { snapshot } } : {}),
        ...(reply.status === "failed" && typeof reply.message === "string" ? { error: reply.message } : {})
      };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  let call = 0;
  const run = async (node: string, parameters: JsonObject): Promise<WebLlmEvidenceToolExecution> => {
    const execution = await runtime.executeTool({ ...BASE, callId: `call.${++call}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
    expect(execution.resultCode, `${node}: ${JSON.stringify(execution.evidence).slice(0, 600)}`).not.toMatch(/rejected/u);
    return execution;
  };

  const looked = await run(LOOK, {});
  // A look changes nothing and is not a step of any Flow.
  expect(looked.effectApplied).toBe(false);
  expect(looked.draft?.proposes).toBe(false);

  const opened = await run(CLICK, { target: { handle: targetNamed(looked, "New post") } });
  // A press that opens the composer is a step the Flow keeps, with the handle
  // the model wrote, which Core resolves again when the plan is assembled.
  expect(opened.effectApplied).toBe(true);
  expect(opened.draft?.proposes).toBe(true);

  const text = "Trail update for Thursday morning";
  const entries = [
    { name: "Post text", node: TYPE, parameters: { text } },
    { name: "Account", node: SELECT, parameters: { value: "photogram-northwind-trails" } },
    { name: "Date", node: TYPE, parameters: { text: "2026-09-24" } },
    { name: "Time", node: TYPE, parameters: { text: "09:00" } }
  ] as const;

  // Every entry is made with the handle the *composer's own* packet gave, not
  // with one re-read after the entry before it: a handle that stopped naming
  // its field would fail here rather than quietly aim somewhere else.
  const planned = entries.map((entry) => ({ name: entry.name, node: entry.node, parameters: entry.parameters, handle: targetNamed(opened, entry.name) }));
  let latest = opened;
  for (const entry of planned) {
    latest = await run(entry.node, { target: { handle: entry.handle }, ...entry.parameters });
    expect(latest.effectApplied, entry.name).toBe(true);
    expect(latest.draft?.proposes, entry.name).toBe(true);
    // And the handle each other field had is the handle it still has.
    for (const other of planned) {
      if (other.name === entry.name) continue;
      expect(targetNamed(latest, other.name), `${other.name} after ${entry.name}`).toBe(other.handle);
    }
  }

  await expect(page.locator("#composer-body")).toHaveValue(text);
  await expect(page.locator("#composer-account")).toHaveValue("photogram-northwind-trails");
  await expect(page.locator("#composer-date")).toHaveValue("2026-09-24");
  await expect(page.locator("#composer-time")).toHaveValue("09:00");

  // What was typed never reaches the packet, and a control that holds a value
  // says so without quoting it.
  expect(JSON.stringify(latest.evidence)).not.toContain(text);
  expect(JSON.stringify(latest.evidence)).not.toContain("2026-09-24");
  const timeEvidence = evidenceElementNamed(latest, "Time");
  expect(timeEvidence).toMatchObject({ name: "Time", hasValue: true });
  expect(timeEvidence).not.toHaveProperty("value");
  expect(timeEvidence).not.toHaveProperty("text", "09:00");
});

function targetNamed(execution: WebLlmEvidenceToolExecution, name: string): string {
  const found = evidenceElementNamed(execution, name);
  if (typeof found?.target !== "string") throw new Error(`Live evidence did not contain an actionable ${name} field.`);
  return found.target;
}

function evidenceElementNamed(execution: WebLlmEvidenceToolExecution, name: string): Record<string, unknown> {
  const elements = (execution.evidence as { elements?: Array<Record<string, unknown>> }).elements ?? [];
  const found = elements.find((element) => element.name === name || element.text === name);
  if (!found) throw new Error(`Live evidence did not contain ${name}.`);
  return found;
}
