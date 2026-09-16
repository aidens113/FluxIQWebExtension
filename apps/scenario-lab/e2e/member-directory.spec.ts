import { expect, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import {
  memberDirectoryScenario, rosterFor, statsText, RECORDED_MEMBER,
  type MemberDirectoryState,
} from "../src/scenarios/member-directory/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const manifest = memberDirectoryScenario.manifest;
const START = memberDirectoryScenario.startPath;
const SCENARIO = "member-directory";

// Seed 42, not the manifest seed: the roster, and so every expected record, must not depend on the lab seed.
test.use({ labSeed: 42 });

type Selection = { workflowId?: string; variantId?: string };
type Run = Selection & { state: Partial<MemberDirectoryState> };

const key = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "unarmed"}`;
const directoryState = (lab: RunningScenarioLab) => readFinalState<MemberDirectoryState>(lab, SCENARIO);
const promoted = { mode: "baseline", roles: { [RECORDED_MEMBER.id]: "Admin" }, removed: [], oracle: { memberCount: 240, adminCount: 44, pendingCount: 32 } } satisfies Partial<MemberDirectoryState>;
const untouched = { roles: {}, removed: [], activity: [], oracle: { memberCount: 240, adminCount: 43, pendingCount: 32 } } satisfies Partial<MemberDirectoryState>;

/** The runs whose recording script plays through to the end. The two negative variants have a test each. */
const runs: Run[] = [
  { state: promoted },
  { variantId: "restyled", state: { ...promoted, mode: "restyled" } },
  { workflowId: "filter-members", state: { ...untouched, mode: "baseline" } },
  { workflowId: "filter-members", variantId: "sorted-by-activity", state: { ...untouched, mode: "sorted-by-activity" } },
  {
    workflowId: "remove-invitations",
    state: { mode: "baseline", roles: {}, oracle: { memberCount: 208, adminCount: 38, pendingCount: 0 } },
  },
];

test("every manifest workflow and variant is either driven here or covered by its own test", () => {
  const declared = [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)].map((variantId) => key({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
  const covered = [...runs.map(key), "primary/member-left", "remove-invitations/support-drawer"];
  expect([...covered].sort()).toEqual([...declared].sort());
});

for (const run of runs) {
  test(`${key(run)} meets its page facts, extraction, final state, and server oracle`, async ({ page, lab, networkGuard: _guard }) => {
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
    expect(await directoryState(lab)).toMatchObject(run.state);
    expect(pageErrors).toEqual([]);
  });
}

test("primary/member-left leaves the recorded row absent and the roster untouched", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { variantId: "member-left" });
  await armVariant(lab, SCENARIO, workflow.variant);
  await page.goto(`${lab.origin}${START}`);
  await assertFacts(page, scenarioPageFactSchedule(manifest, { variantId: "member-left" }, "arms-before-loading").atLoad);

  const recordedTarget = locate(page, workflow.recordingScript[0]?.target);
  await expect(recordedTarget).toHaveCount(0);
  // The other 239 identical buttons are still there: this is a resolution
  // question about which row, not a page with nothing on it.
  await expect(page.getByRole("button", { name: "Row actions", exact: true })).toHaveCount(239);
  await expect(page.getByTestId("edit-dialog")).toHaveCount(0);
  await expect(page.getByTestId("toast")).toHaveCount(0);
  expect(await directoryState(lab)).toMatchObject({
    mode: "member-left", roles: {}, removed: [], oracle: { memberCount: 239, adminCount: 43, pendingCount: 32 },
  });
});

test("remove-invitations/support-drawer: the drawer covers Remove and the click never reaches it", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "remove-invitations", variantId: "support-drawer" });
  await armVariant(lab, SCENARIO, workflow.variant);
  await page.goto(`${lab.origin}${START}`);
  await assertFacts(page, scenarioPageFactSchedule(manifest, { workflowId: "remove-invitations", variantId: "support-drawer" }, "arms-before-loading").atLoad);

  await page.getByTestId("status-filter").selectOption("invited");
  await expect(page.getByTestId("filter-summary")).toBeVisible();
  await page.getByRole("checkbox", { name: "Select all members", exact: true }).setChecked(true);
  await expect(page.getByTestId("bulk-toolbar")).toContainText("32 selected");

  const remove = page.getByRole("button", { name: "Remove", exact: true });
  await expect(remove).toBeVisible();
  expect(await topmostOver(remove)).toBe("support-drawer");
  let refusal: Error | undefined;
  await remove.click({ timeout: 1_500 }).catch((error: Error) => { refusal = error; });
  expect(refusal?.message ?? "").toContain("intercepts pointer events");

  await assertFacts(page, workflow.expected.finalState);
  expect(await directoryState(lab)).toMatchObject({ mode: "support-drawer", removed: [], oracle: { memberCount: 240, adminCount: 43, pendingCount: 32 } });
});

test("the page is application-shaped: hashed classes, 240 identical action buttons, and surfaces that cover them", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${START}`);

  const shape = await page.evaluate(() => {
    let deepest = 0;
    for (const element of document.querySelectorAll("*")) {
      let depth = 0;
      for (let node = element as Element | null; node; node = node.parentElement) depth += 1;
      deepest = Math.max(deepest, depth);
    }
    const classes = new Set<string>();
    for (const element of document.querySelectorAll("[class]")) for (const name of element.classList) classes.add(name);
    return {
      elements: document.querySelectorAll("*").length,
      depth: deepest,
      cells: document.querySelectorAll("td,th").length,
      focusable: document.querySelectorAll("a[href],button,input,select,textarea").length,
      classes: classes.size,
      authored: [...classes].filter((name) => !/^css-[0-9a-z]{7}$/.test(name)),
      unnamedButtons: [...document.querySelectorAll("button")].filter((button) =>
        !button.textContent?.trim() && !button.getAttribute("aria-label") && !button.getAttribute("title")).length,
      // The three queries the content script's snapshot collects candidates
      // from (apps/extension/src/content/dom-snapshot.ts), counted here so the
      // fixture's size can be compared with that file's 2,000-candidate cap.
      snapshotCandidates: new Set([
        ...document.querySelectorAll("a[href],button,input:not([type=hidden]),textarea,select,summary,label,[role=button],[role=link],[role=menuitem],[role=checkbox],[role=radio],[role=tab],[role=switch],[contenteditable=true]"),
        ...document.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,dt,dd,figcaption"),
        ...document.querySelectorAll("img,svg,picture,canvas,video"),
      ]).size,
    };
  });
  console.log(`member-directory page shape: ${JSON.stringify(shape)}`);
  expect(shape.elements).toBeGreaterThan(4_000);
  // The point of the scale: this page asks the snapshot for more candidates
  // than it is allowed to keep, which no fixture has done before.
  expect(shape.snapshotCandidates).toBeGreaterThan(2_000);
  expect(shape.authored).toEqual([]);
  // A design system's own build has no accessible name to spare for every
  // control: one top-bar button has neither text, label, nor title.
  expect(shape.unnamedButtons).toBe(1);

  // The row action button and the top bar's notification button are the same
  // component, so they wear the same generated class.
  const rowButton = page.locator(`[data-member-id="${RECORDED_MEMBER.id}"] button[aria-haspopup="menu"]`);
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  expect(await rowButton.getAttribute("class")).toBe(await bell.getAttribute("class"));
  await expect(page.getByRole("button", { name: "Row actions", exact: true })).toHaveCount(240);
  await expect(page.getByLabel("Search", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Invite people", exact: true })).toHaveCount(2);

  // Scrolled under the sticky header, a row's action button is still laid out,
  // still visible, and painted over by a table header cell.
  await page.evaluate((selector) => {
    const button = document.querySelector(selector);
    if (!button) throw new Error("no row action button");
    const box = button.getBoundingClientRect();
    window.scrollBy(0, box.top + box.height / 2 - 72);
  }, `[data-member-id="${RECORDED_MEMBER.id}"] button[aria-haspopup="menu"]`);
  await expect(rowButton).toBeVisible();
  expect(await topmostTag(rowButton)).toBe("TH");

  // Mid-scroll, the fixed help launcher sits over the action column.
  await page.evaluate(() => window.scrollTo(0, 3_000));
  const underLauncher = await page.evaluate(() => {
    const launcher = document.querySelector('button[aria-label="Help and support"]');
    const covered: string[] = [];
    for (const button of document.querySelectorAll("tbody tr[data-member-id] button[aria-haspopup=\"menu\"]")) {
      const box = button.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) continue;
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (hit && launcher?.contains(hit)) covered.push((button.closest("tr") as HTMLElement).dataset.memberId ?? "");
    }
    return covered;
  });
  console.log(`member-directory rows whose action button the help launcher covers at scroll 3000: ${JSON.stringify(underLauncher)}`);
  expect(underLauncher.length).toBeGreaterThan(0);
});

test("filtering, sorting, the row menu and the bulk toolbar behave as a console does", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${START}`);
  await expect(page.getByTestId("filter-summary")).toHaveCount(0);

  await page.getByTestId("member-search").fill("hollis");
  await expect(page.getByTestId("result-count")).toHaveText("Showing 16 of 240 members");
  await expect(page.getByTestId("filter-summary")).toContainText("Search: hollis");
  await page.getByTestId("status-filter").selectOption("suspended");
  await expect(page.getByTestId("result-count")).toHaveText("Showing 1 of 240 members");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByTestId("result-count")).toHaveText("Showing 240 of 240 members");
  await expect(page.getByTestId("filter-summary")).toHaveCount(0);

  // Sorting is the page's own, and it reorders the same row elements.
  await page.getByRole("button", { name: "Last active", exact: true }).click();
  await expect(page.getByTestId("sort-status")).toHaveText("Sorted by Last active");
  expect(await page.locator("tbody tr[data-member-id]").first().getAttribute("data-member-id"))
    .toBe(rosterFor("sorted-by-activity")[0]?.id);

  // The row menu is portalled to the end of the body, so the row it belongs to
  // is nowhere in its ancestry.
  const target = page.locator(`[data-member-id="${RECORDED_MEMBER.id}"] button[aria-haspopup="menu"]`);
  await target.scrollIntoViewIfNeeded();
  await target.click();
  const menu = page.getByRole("menu", { name: `Actions for ${RECORDED_MEMBER.name}` });
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((node) => node.parentElement?.tagName)).toBe("BODY");
  await expect(menu.getByRole("menuitem")).toHaveText(["Edit member", "Copy member ID", "Remove from workspace"]);
  await page.keyboard.press("Escape");

  // One selection is enough to bring up the bulk toolbar, and clearing it
  // takes the toolbar away again.
  const box = page.locator(`[data-member-id="${RECORDED_MEMBER.id}"] input[type="checkbox"]`);
  await box.setChecked(true);
  await expect(page.getByTestId("bulk-toolbar")).toContainText("1 selected");
  await box.setChecked(false);
  await expect(page.getByTestId("bulk-toolbar")).toHaveCount(0);
  expect(await directoryState(lab)).toMatchObject({ mode: "baseline", roles: {}, removed: [], activity: [] });
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
    else if (step.operation === "waitForState") await expect(target()).toBeVisible(step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs });
    else if (step.operation === "extract") extracted.set(step.id, await extract(page, step));
    else if (step.operation !== "checkpoint") throw new Error(`Unsupported step ${step.operation}`);
  }
  return extracted;
}

/** `column:<header>` reads the cell under that header; `@attribute` reads an attribute of the row itself. */
async function extract(page: Page, step: ScenarioStep): Promise<Array<Record<string, string>>> {
  const records: Array<Record<string, string>> = [];
  for (const item of await locate(page, step.target).all()) {
    const record: Record<string, string> = {};
    for (const [name, selector] of Object.entries(step.fields ?? {})) {
      if (selector.startsWith("column:")) record[name] = await readColumn(item, selector.slice("column:".length));
      else if (selector.startsWith("@")) record[name] = (await item.getAttribute(selector.slice(1))) ?? "";
      else throw new Error(`Unsupported extract field ${selector}`);
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

/** The `data-testid` of whatever is painted over the middle of a control, or "" when the control itself is on top. */
async function topmostOver(control: Locator): Promise<string> {
  return control.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (!hit || hit === element || element.contains(hit)) return "";
    return hit.closest("[data-testid]")?.getAttribute("data-testid") ?? hit.tagName;
  });
}

async function topmostTag(control: Locator): Promise<string> {
  return control.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (!hit || hit === element || element.contains(hit)) return "";
    return hit.closest("th") ? "TH" : hit.tagName;
  });
}

test("the roster the manifest was written against is the roster the page renders", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${START}`);
  await expect(page.getByTestId("member-stats")).toHaveText(statsText(rosterFor("baseline")));
  await expect(page.locator("tbody tr[data-member-id]")).toHaveCount(rosterFor("baseline").length);
});
