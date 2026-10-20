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
//   handle each other field had is the handle it still has afterwards.
//
// t730 moved the row off the synthetic social scheduler onto realistic pages
// and onto the evidence the model now reads: the compact page view, one line
// per element (`t14 button "Get a free quote"`), whose `tN` is the handle. The
// text fields are the company website's quote drawer, opened from its header
// button; the select is the auction site's header category picker, because the
// drawer has none. The row used to also claim that what was typed never
// reaches the packet. That stopped being the contract when the page view began
// printing a field's value (`="…"`, `domain/src/runtime/llm-evidence/page-view/
// element/state-tokens.ts`); a sensitive control's value is still withheld,
// which `evidence/tests/sensitive-names.spec.ts` pins. So the row now checks
// that each entry is what the next packet shows, on the line its handle names.

import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution
} from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const BASE = { projectId: "project.live-field-entry", flowId: "flow.live-field-entry", maxEvidenceBytes: 16_000 } as const;

/** The nodes this row runs, as the catalog names them; `core.run_node` takes the node's own parameters. */
const LOOK = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const TYPE = "web.output.dom-type";
const SELECT = "web.output.dom-select";

/** Sends one of the site's own state operations, as its page script does. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

/** The evidence runtime over the harness, and a `core.run_node` call that must not be refused. */
function nodeRunner(harness: ContentHarness): (node: string, parameters: JsonObject) => Promise<WebLlmEvidenceToolExecution> {
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
  return async (node, parameters) => {
    const execution = await runtime.executeTool({ ...BASE, callId: `call.${++call}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
    expect(execution.resultCode, `${node}: ${JSON.stringify(execution.evidence).slice(0, 600)}`).not.toMatch(/rejected/u);
    return execution;
  };
}

/** One entry of the row: the field's name in the page view, the node, its parameters, and how its line reads afterwards. */
type Entry = { name: string; node: string; parameters: JsonObject; shows: string };

/**
 * Makes every entry with the handle the *opening* packet gave, not one re-read
 * after the entry before it -- a handle that stopped naming its field would
 * fail here rather than quietly aim somewhere else -- and checks after each
 * that every other field keeps the handle it had.
 */
async function enterAll(run: (node: string, parameters: JsonObject) => Promise<WebLlmEvidenceToolExecution>, opened: WebLlmEvidenceToolExecution, entries: Entry[]): Promise<WebLlmEvidenceToolExecution> {
  const planned = entries.map((entry) => ({ ...entry, handle: handleNamed(opened, entry.name) }));
  let latest = opened;
  for (const entry of planned) {
    latest = await run(entry.node, { target: { handle: entry.handle }, ...entry.parameters });
    expect(latest.effectApplied, entry.name).toBe(true);
    expect(latest.draft?.proposes, entry.name).toBe(true);
    expect(lineOf(latest, entry.handle), `${entry.name} shows its entry on its own line`).toContain(entry.shows);
    for (const other of planned) {
      if (other.name === entry.name) continue;
      expect(handleNamed(latest, other.name), `${other.name} after ${entry.name}`).toBe(other.handle);
    }
  }
  return latest;
}

test("enters a live form's text fields through the Flow's own nodes, with handles that keep naming the same controls", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("company-website");
  // A returning visitor: cookies answered and the newsletter offer and chat greeting dismissed.
  await mutate(harness, "set-consent", { choice: "all" });
  await mutate(harness, "dismiss-newsletter");
  await mutate(harness, "dismiss-chat-greeting");
  await page.reload();
  const run = nodeRunner(harness);

  const looked = await run(LOOK, {});
  // A look changes nothing and is not a step of any Flow.
  expect(looked.effectApplied).toBe(false);
  expect(looked.draft?.proposes).toBe(false);

  const opened = await run(CLICK, { target: { handle: handleNamed(looked, "Get a free quote") } });
  // A press that opens the drawer is a step the Flow keeps, with the handle
  // the model wrote, which Core resolves again when the plan is assembled.
  expect(opened.effectApplied).toBe(true);
  expect(opened.draft?.proposes).toBe(true);
  await expect(page.getByRole("dialog", { name: "Get a free quote" })).toBeVisible();

  await enterAll(run, opened, [
    { name: "Full name", node: TYPE, parameters: { text: "Ada Lovelace" }, shows: "=\"Ada Lovelace\"" },
    { name: "Email address", node: TYPE, parameters: { text: "ada@example.test" }, shows: "=\"ada@example.test\"" },
    { name: "Phone number", node: TYPE, parameters: { text: "01632960418" }, shows: "=\"01632960418\"" },
    { name: "Postcode of the property", node: TYPE, parameters: { text: "WR1 2AB" }, shows: "=\"WR1 2AB\"" }
  ]);

  await expect(page.locator("input[name=\"fullName\"]")).toHaveValue("Ada Lovelace");
  await expect(page.locator("input[name=\"email\"]")).toHaveValue("ada@example.test");
  await expect(page.locator("input[name=\"phone\"]")).toHaveValue("01632960418");
  await expect(page.locator("input[name=\"postcode\"]")).toHaveValue("WR1 2AB");
});

test("enters a live select and a text field through the Flow's own nodes, with handles that keep naming the same controls", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("auction-marketplace");
  const run = nodeRunner(harness);
  const looked = await run(LOOK, {});
  expect(looked.effectApplied).toBe(false);

  await enterAll(run, looked, [
    { name: "Select a category for search", node: SELECT, parameters: { value: "625" }, shows: "Cameras & Photography" },
    { name: "Search for anything", node: TYPE, parameters: { text: "kestrel 35" }, shows: "=\"kestrel 35\"" }
  ]);

  await expect(page.locator("select[name=\"_sacat\"]")).toHaveValue("625");
  await expect(page.locator("input[name=\"_nkw\"]")).toHaveValue("kestrel 35");
});

function pageOf(execution: WebLlmEvidenceToolExecution): string {
  const page = (execution.evidence as { page?: unknown }).page;
  return typeof page === "string" ? page : "";
}

/**
 * The handle of the first control line naming `name` in the packet's page view:
 * a line with a kind (`field`, `button`), not a bare text line such as a label.
 */
function handleNamed(execution: WebLlmEvidenceToolExecution, name: string): string {
  const quoted = JSON.stringify(name).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const found = pageOf(execution).match(new RegExp(`^(t\\d+) [a-z][^"\\n]* ${quoted}`, "mu"))?.[1];
  if (!found) throw new Error(`Live evidence did not contain ${name}: ${pageOf(execution).slice(0, 1200)}`);
  return found;
}

/** The whole page-view line a handle names. */
function lineOf(execution: WebLlmEvidenceToolExecution, handle: string): string {
  return pageOf(execution).split("\n").find((line) => line.startsWith(`${handle} `)) ?? "";
}
