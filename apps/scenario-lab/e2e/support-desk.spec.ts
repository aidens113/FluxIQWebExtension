import { expect, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import {
  ESCALATIONS_PATH, longestBreachingTicket, queueCounts, REPLY_TICKET, supportDeskScenario,
  supportTickets, TRIAGE_AGENT, type SupportDeskState,
} from "../src/scenarios/support-desk/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const manifest = supportDeskScenario.manifest;
const START = supportDeskScenario.startPath;
const SCENARIO = "support-desk";

// Seed 42, not the manifest seed: the queue, and so every expected record, must not depend on the lab seed.
test.use({ labSeed: 42 });

type Selection = { workflowId?: string; variantId?: string };

const key = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "unarmed"}`;
const deskState = (lab: RunningScenarioLab) => readFinalState<SupportDeskState>(lab, SCENARIO);
const BASE = queueCounts(supportTickets);

/**
 * Every workflow whose recorded script plays through to the end. The two
 * drifted renderings are a test each, because the recorded script cannot reach
 * their first control at all -- which is the whole point of them.
 */
const runs: Selection[] = [
  {},
  { workflowId: "reply-and-resolve" },
  { workflowId: "export-sla-breaches" },
  { workflowId: "export-sla-breaches", variantId: "recovered-sla" },
  { workflowId: "escalate-longest-breach" },
];

test("every manifest workflow and variant is either driven here or covered by its own test", () => {
  const declared = [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)].map((variantId) => key({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
  expect([...runs.map(key), "primary/relabelled-triage"].sort()).toEqual([...declared].sort());
});

for (const run of runs) {
  test(`${key(run)} meets its page facts, extraction and final state`, async ({ page, lab, networkGuard: _guard }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const workflow = resolveScenarioWorkflow(manifest, run);
    const schedule = scenarioPageFactSchedule(manifest, run, workflow.variant ? "arms-before-loading" : "unarmed");
    if (workflow.variant) await armVariant(lab, SCENARIO, workflow.variant);
    await page.goto(`${lab.origin}${START}`);
    await assertFacts(page, schedule.atLoad);

    const extracted = await runScript(page, workflow.recordingScript);
    for (const expectation of workflow.expected.extracted ?? []) {
      const records = extracted.get(expectation.step);
      expect(records, expectation.step).toBeDefined();
      if (expectation.count !== undefined) expect(records, expectation.step).toHaveLength(expectation.count);
      if (expectation.records) expect(records, expectation.step).toEqual(expectation.records);
    }
    await assertFacts(page, workflow.expected.finalState);
    expect(pageErrors).toEqual([]);
  });
}

test("triaging the backlog moves it onto one agent, and the desk's own oracle agrees", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${START}`);
  await runScript(page, manifest.recordingScript);
  const state = await deskState(lab);
  expect(state.oracle.awaitingTriageCount).toBe(0);
  expect(state.oracle.unassignedCount).toBe(BASE.unassignedCount - Object.keys(state.assignments).length);
  expect([...new Set(Object.values(state.assignments))]).toEqual([TRIAGE_AGENT]);
});

test("replying and resolving closes the ticket and stops its countdown on the desk", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "reply-and-resolve" });
  await page.goto(`${lab.origin}${START}`);
  await runScript(page, workflow.recordingScript);
  const state = await deskState(lab);
  expect(state.resolved).toEqual([REPLY_TICKET.reference]);
  expect(state.replies).toEqual([REPLY_TICKET.reference]);
  expect(state.oracle.breachingCount).toBe(BASE.breachingCount - 1);
});

test("an escalation carries a reference off the queue and the desk names its own requester", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "escalate-longest-breach" });
  await page.goto(`${lab.origin}${START}`);
  await runScript(page, workflow.recordingScript);
  const longest = longestBreachingTicket(supportTickets);
  expect(await deskState(lab)).toMatchObject({
    escalations: [{ reference: longest.reference, severity: "Critical", requester: longest.requester }],
  });
});

test("the escalation form refuses a reference the desk does not hold", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${ESCALATIONS_PATH}`);
  const raise = page.getByTestId("raise-escalation");
  await expect(raise).toBeDisabled();
  await page.getByTestId("escalation-reference").fill("TCK-0000");
  await page.getByTestId("escalation-severity").selectOption("critical");
  await expect(raise).toBeDisabled();
  // A reference alone is not enough either: the severity has to be chosen too.
  await page.getByTestId("escalation-reference").fill(REPLY_TICKET.reference);
  await expect(raise).toBeEnabled();
  await page.getByTestId("escalation-severity").selectOption("");
  await expect(raise).toBeDisabled();
  expect(await deskState(lab)).toMatchObject({ escalations: [] });
});

test("primary/relabelled-triage: the recorded shortcut is gone, and pressing its replacement reaches the declared state", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { variantId: "relabelled-triage" });
  await armVariant(lab, SCENARIO, workflow.variant);
  await page.goto(`${lab.origin}${START}`);
  await assertFacts(page, scenarioPageFactSchedule(manifest, { variantId: "relabelled-triage" }, "arms-before-loading").atLoad);

  await expect(locate(page, workflow.recordingScript[0]?.target)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Triage queue", exact: true })).toHaveCount(0);
  // The two pressable wrong answers are still there, so re-pointing the click
  // is a judgement rather than a guess at the only button left.
  for (const decoy of ["Import", "New ticket"]) {
    await expect(page.getByRole("button", { name: decoy, exact: true })).toHaveCount(1);
  }

  // The repaired run: the same script with its first click re-pointed.
  await page.getByRole("button", { name: "Work the backlog", exact: true }).click();
  await runScript(page, manifest.recordingScript.slice(1));
  await assertFacts(page, workflow.expected.finalState);
  const state = await deskState(lab);
  expect(state.mode).toBe("relabelled-triage");
  expect(state.oracle.awaitingTriageCount).toBe(0);
});

test("the queue is application-shaped: hashed classes, 320 identical action buttons, and a pane fetched on demand", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${START}`);
  const shape = await page.evaluate(() => {
    const classes = new Set<string>();
    for (const element of document.querySelectorAll("[class]")) for (const name of element.classList) classes.add(name);
    return {
      elements: document.querySelectorAll("*").length,
      authored: [...classes].filter((name) => !/^css-[0-9a-z]{7}$/.test(name)),
      unnamedButtons: [...document.querySelectorAll("button")].filter((button) =>
        !button.textContent?.trim() && !button.getAttribute("aria-label") && !button.getAttribute("title")).length,
    };
  });
  console.log(`support-desk page shape: ${JSON.stringify(shape)}`);
  expect(shape.elements).toBeGreaterThan(4_000);
  expect(shape.authored).toEqual([]);
  expect(shape.unnamedButtons).toBe(1);

  await expect(page.getByRole("button", { name: "More actions", exact: true })).toHaveCount(320);
  await expect(page.getByRole("checkbox", { name: "Select ticket", exact: true })).toHaveCount(320);
  await expect(page.getByLabel("Search", { exact: true })).toHaveCount(2);

  // The row action button and the top bar's notification button are the same
  // component, so they wear the same generated class.
  const rowButton = page.locator(`[data-ticket-ref="${REPLY_TICKET.reference}"] button[aria-haspopup="menu"]`);
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  expect(await rowButton.getAttribute("class")).toBe(await bell.getAttribute("class"));

  // The requester's account is on the ticket and on no other screen, so it is
  // not in the queue's markup waiting to be read.
  expect(await page.content()).not.toContain(REPLY_TICKET.account);
  await page.locator(`[data-ticket-ref="${REPLY_TICKET.reference}"] button[aria-controls="ticket-detail"]`).click();
  await expect(page.getByTestId("ticket-detail")).toBeVisible();
  await expect(page.getByTestId("ticket-detail")).toContainText(REPLY_TICKET.account);
  await expect(page.getByTestId("send-reply")).toBeDisabled();
});

test("views, filters and the empty state behave as a desk does", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${START}`);
  await expect(page.getByTestId("filter-summary")).toHaveCount(0);
  await expect(page.getByTestId("result-count")).toHaveText(`Showing ${BASE.ticketCount} of ${BASE.ticketCount} tickets`);

  await page.getByTestId("saved-view").selectOption("breaching");
  await expect(page.getByTestId("result-count")).toHaveText(`Showing ${BASE.breachingCount} of ${BASE.ticketCount} tickets`);
  await expect(page.getByTestId("filter-summary")).toContainText("View: Breaching SLA");

  // A view and a filter that cannot both hold leaves the queue empty.
  await page.getByTestId("status-filter").selectOption("resolved");
  await expect(page.getByTestId("result-count")).toHaveText(`Showing 0 of ${BASE.ticketCount} tickets`);
  await expect(page.locator("tbody")).toContainText("No tickets match this view.");

  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByTestId("result-count")).toHaveText(`Showing ${BASE.ticketCount} of ${BASE.ticketCount} tickets`);
  expect(await deskState(lab)).toMatchObject({ assignments: {}, resolved: [], escalations: [] });
});

/** A manifest target: `testid:`, `role:<role>[:<name>]`, or a raw CSS selector, read the way the runner reads one. */
function locate(page: Page, target: string | undefined): Locator {
  if (!target) throw new Error("Scenario step target is required");
  if (target.startsWith("testid:")) return page.getByTestId(target.slice("testid:".length));
  if (target.startsWith("role:")) {
    const body = target.slice("role:".length);
    const separator = body.indexOf(":");
    const role = (separator < 0 ? body : body.slice(0, separator)) as Parameters<Page["getByRole"]>[0];
    return separator < 0 ? page.getByRole(role) : page.getByRole(role, { name: body.slice(separator + 1), exact: true });
  }
  return page.locator(target);
}

async function assertFacts(page: Page, facts: readonly ExpectedFact[] = []): Promise<void> {
  for (const fact of facts) {
    if (fact.predicate.startsWith("label-count:")) {
      const label = fact.predicate.slice("label-count:".length);
      await expect(page.locator("label").filter({ hasText: label }), fact.id).toHaveCount(Number(fact.value));
      continue;
    }
    if (fact.predicate === "path") {
      expect(new URL(page.url()).pathname, fact.id).toBe(String(fact.value));
      continue;
    }
    const target = page.getByTestId(fact.subject);
    if (fact.predicate === "text") await expect(target, fact.id).toHaveText(String(fact.value));
    else if (fact.predicate === "exists") await expect(target, fact.id).toHaveCount(fact.value === true ? 1 : 0);
    else if (fact.predicate === "visible") await expect(target, fact.id).toBeVisible({ visible: fact.value === true });
    else throw new Error(`Unsupported predicate ${fact.predicate}`);
  }
}

/** Plays a recording script with plain Playwright and returns each extract step's records. */
async function runScript(page: Page, script: readonly ScenarioStep[]): Promise<Map<string, Array<Record<string, string>>>> {
  const extracted = new Map<string, Array<Record<string, string>>>();
  for (const step of script) {
    const target = () => locate(page, step.target);
    if (step.operation === "click") await target().click();
    else if (step.operation === "type") await target().fill(String(step.value));
    else if (step.operation === "select") await target().selectOption(String(step.value));
    else if (step.operation === "check") await target().setChecked(step.value === true);
    else if (step.operation === "waitForState") await expect(target(), step.id).toBeVisible(step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs });
    else if (step.operation === "extract") extracted.set(step.id, await extract(page, step));
    else if (step.operation !== "checkpoint") throw new Error(`Unsupported step ${step.operation}`);
  }
  return extracted;
}

/** `column:<header>` reads the cell under that header; anything else is a selector inside the item. */
async function extract(page: Page, step: ScenarioStep): Promise<Array<Record<string, string>>> {
  const records: Array<Record<string, string>> = [];
  for (const item of await locate(page, step.target).all()) {
    const record: Record<string, string> = {};
    for (const [name, selector] of Object.entries(step.fields ?? {})) {
      record[name] = selector.startsWith("column:")
        ? await readColumn(item, selector.slice("column:".length))
        : ((await item.locator(selector).first().textContent()) ?? "").replace(/\s+/gu, " ").trim();
    }
    records.push(record);
  }
  return records;
}

function readColumn(row: Locator, header: string): Promise<string> {
  return row.evaluate((element, wanted) => {
    const normalize = (text: string | null) => (text ?? "").replace(/\s+/gu, " ").trim();
    const cells = [...(element as HTMLTableRowElement).cells];
    const headerCells = [...((element as HTMLTableRowElement).closest("table")?.tHead?.rows[0]?.cells ?? [])];
    const index = headerCells.findIndex((cell) => normalize(cell.textContent) === wanted);
    return index < 0 ? "" : normalize(cells[index]?.textContent ?? "");
  }, header);
}
