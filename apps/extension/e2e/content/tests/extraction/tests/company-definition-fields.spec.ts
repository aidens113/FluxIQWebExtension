// Real detected fields must retain their meaning on later cards whose
// definition pairs have a different order. This uses the unchanged realistic
// task and its full expected dataset; no model or provider participates.
import { gatewayActionResultFromBrowserResult, WEB_AUTOMATION_FAILURE_CODES, type WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import { expect, test, type ContentHarness } from "../../../index.js";
import { GAS_ENGINEER_RECORDS } from "../../../../../../scenario-lab/src/scenarios/company-website/index.js";
import { TEAM, TEAM_BATCH_SIZE } from "../../../../../../scenario-lab/src/scenarios/company-website/data/index.js";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { webNodeDispatchWithRetries } from "../../../../../../../domain/src/runtime/llm-evidence/node-run/retries/index.js";

type Field = WebAutomationExtractionProposal["fields"][number];
type ProposalReply = { ok: true; proposal: WebAutomationExtractionProposal } | { ok: false };

async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

function definition(proposal: WebAutomationExtractionProposal, term: string, part: "term" | "value"): Field {
  const fields = proposal.fields.filter((field) => field.spec.definition?.term === term && field.spec.definition.part === part);
  expect(fields, "one detected field retains this exact semantic term and part").toHaveLength(1);
  return fields[0]!;
}

/** Production Domain/Core retries around the content/page-world harness transport; no installed host or service worker. */
async function nextPageWithHostRetries(harness: ContentHarness, item: string, control: string) {
  const parameters = { timeoutMs: 30_000, nextPage: { item, pagination: { mode: "loadMore", control } } } satisfies Pick<BrowserActionCommand, "timeoutMs" | "nextPage">;
  const receipts: BrowserActionResult[] = [];
  const sessionId = "paired.company-content-harness";
  const run: Parameters<typeof webNodeDispatchWithRetries>[0] = {
    gateway: {
      eligibleSessionIds: () => [sessionId], structureDetectionSessionIds: () => [sessionId],
      executeAction: async (_sessionId, command) => {
        expect(command.actionType).toBe("web.dom.next_page");
        expect(command.parameters).toEqual(parameters);
        const receipt = await harness.runAction({ ...parameters, commandId: `company-semantic-next-${receipts.length + 1}`, actionType: "web.dom.next_page" });
        receipts.push(receipt);
        return gatewayActionResultFromBrowserResult(receipt);
      }
    },
    sessionId,
    request: { projectId: "project.company-content-harness", flowId: "flow.company-content-harness", callId: "semantic-next", toolId: "core.run_node", value: {}, permission: async () => ({ permitted: true }) }
  };
  const outcome = await webNodeDispatchWithRetries(run,
    { definitionId: "web.output.dom-next_page", effect: "mutate", declared: [] },
    { actionType: "web.dom.next_page", parameters, metadata: {} }
  );
  return { outcome, receipts };
}

test("company-website: detected definition fields keep all eight matching records after later credentials change pair positions", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("company-website");
  await apply(harness, "set-consent", { choice: "essential" });
  await apply(harness, "dismiss-newsletter");
  await apply(harness, "dismiss-chat-greeting");
  await page.goto(new URL("/scenarios/company-website/team", harness.lab.origin).href);
  const people = 'section[aria-label="Our people"]';
  await expect(page.locator(`${people} article h3`).first()).toBeVisible();
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  const delivery = await harness.deliver({ type: "extraction.propose", selector: `${people} article h3` });
  expect(delivery.responded).toBe(true);
  const proposed = delivery.response as ProposalReply;
  expect(proposed.ok).toBe(true);
  if (!proposed.ok) throw new Error("No team-grid proposal.");
  const proposal = proposed.proposal;
  const originalNames = await page.locator(`${proposal.item} h3`).allTextContents();
  const expectedNames = GAS_ENGINEER_RECORDS.map((row) => {
    if (typeof row.name !== "string") throw new Error("Each expected record must name its person.");
    return row.name;
  });
  const plainField = async (target: string): Promise<Field> => {
    const key = await page.evaluate(({ item, fields, target }) => {
      const rows = [...document.querySelectorAll(item)];
      return fields.find((field) => field.spec.kind === "text" && !field.spec.definition && rows.every((row) => {
        const expected = row.querySelector(target);
        const actual = field.spec.selector ? row.querySelector(field.spec.selector) : row;
        return expected !== null && actual === expected;
      }))?.key;
    }, { item: proposal.item, fields: proposal.fields, target });
    const field = proposal.fields.find((candidate) => candidate.key === key);
    expect(field, "the detected field reads this exact card member").toBeTruthy();
    if (!field) throw new Error("Missing ordinary card field.");
    return field;
  };
  const name = await plainField("h3");
  const role = await plainField(":scope > p");
  const branch = definition(proposal, "Branch", "value");
  const credential = definition(proposal, "Gas Safe ID", "term");
  const identifier = definition(proposal, "Gas Safe ID", "value");

  // Structural terms may be proposed, but names and identifier values may not.
  const wire = JSON.stringify(proposal);
  for (const row of GAS_ENGINEER_RECORDS) {
    expect(wire).not.toContain(row.name);
    expect(wire).not.toContain(row.gasSafeId);
  }
  const more = page.locator(`${people} > button`);
  for (let scroll = 0; scroll < 12 && !(await more.isVisible()); scroll += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1_200);
  }
  await expect(more).toBeVisible();
  const beforePage = await page.locator(proposal.item).count();
  const afterPage = Math.min(beforePage + TEAM_BATCH_SIZE, TEAM.length);
  expect(afterPage).toBeGreaterThan(beforePage);
  const presses = await more.evaluateHandle((control) => {
    const state = { count: 0 };
    const count = () => { state.count += 1; };
    control.addEventListener("click", count, true);
    return { state, stop: () => control.removeEventListener("click", count, true) };
  });
  try {
    const { outcome, receipts } = await nextPageWithHostRetries(harness, proposal.item, `${people} > button`);
    expect(outcome.result.status).toBe("succeeded");
    expect(outcome.attempts).toBe(2);
    expect(outcome.lastingAct).toBeUndefined();
    expect(receipts.length).toBe(2);
    const noEffect = receipts[0]?.failure;
    expect({ code: noEffect?.code, stage: noEffect?.stage, effect: noEffect?.effect, certainNoEffect: noEffect?.certainNoEffect, retryable: noEffect?.retryable }).toEqual({
      code: WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT, stage: "execution", effect: "unacted", certainNoEffect: true, retryable: true
    });
    expect(receipts[1]?.status).toBe("succeeded");
    expect(await page.locator(proposal.item).count()).toBe(afterPage);
    expect(await presses.evaluate((observation) => observation.state.count)).toBe(2);
  } finally {
    await presses.evaluate((observation) => observation.stop());
    await presses.dispose();
  }
  await expect(page.getByText("That is everyone.", { exact: true })).toBeVisible();
  expect(await page.locator(proposal.item).count()).toBeGreaterThan(proposal.itemCount);
  expect(expectedNames.some((name) => !originalNames.includes(name))).toBe(true);

  const reply = await harness.runAction({
    commandId: "read-semantic-definition-fields",
    actionType: "web.dom.extract_list",
    extractList: {
      item: proposal.item,
      fields: { name: name.spec, role: role.spec, branch: branch.spec, gasSafeId: identifier.spec },
      where: [
        { field: "branch", matches: ["Eastmoor", "Hollins Cross"] },
        { read: credential.spec, matches: "Gas Safe ID" },
        { field: "gasSafeId", greaterThan: 0 }
      ],
      dedupe: { by: ["name", "role", "branch", "gasSafeId"] }
    }
  });
  expect(reply.status).toBe("succeeded");
  expect(reply.extraction?.recordCount).toBe(8);
  expect(reply.extracted).toEqual(GAS_ENGINEER_RECORDS);
});
