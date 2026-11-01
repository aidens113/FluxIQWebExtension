// Real detected fields must retain their meaning on later cards whose
// definition pairs have a different order. This uses the unchanged realistic
// task and its full expected dataset; no model or provider participates.
import type { WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import { expect, test, type ContentHarness } from "../../../index.js";
import { GAS_ENGINEER_RECORDS } from "../../../../../../scenario-lab/src/scenarios/company-website/index.js";

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
  // The site's first press is swallowed; its honest path presses it again.
  await more.click();
  await more.click();
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
