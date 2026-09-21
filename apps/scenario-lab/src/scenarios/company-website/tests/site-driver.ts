import { randomBytes } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Frame, type Locator, type Page } from "@playwright/test";
import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import type { CompanyWebsiteState } from "../types.js";

/**
 * A person's browser on the company website, for the scenario's own tests.
 *
 * It restates, in miniature, how the Lab drives a recording script and
 * judges a run (`packages/test-runner/src/scenario-steps/` and
 * `scenario-assertions.ts`): scenario-lab depends only on test-contracts, so
 * it cannot import the runner. Targets are `testid:`, `role:`, `frame:` or a
 * Playwright selector; facts are probed by `data-testid` across frames;
 * extracted text is whitespace-collapsed; `column:` reads the cell under a
 * header. Only what this scenario's scripts use is implemented.
 */
export type SiteSession = { lab: RunningScenarioLab; page: Page; context: BrowserContext; consoleErrors: string[] };

const SCENARIO = "company-website";
const START_PATH = `/scenarios/${SCENARIO}/`;

let shared: Promise<Browser> | undefined;

/** One headless Chromium per test file, launched on first use. */
function browser(): Promise<Browser> {
  // Full Chromium, as the lab's own e2e config uses: the headless shell crashes on launch on some Windows hosts.
  shared ??= chromium.launch({ channel: "chromium", headless: true });
  return shared;
}

export async function closeBrowser(): Promise<void> {
  if (shared) await (await shared).close();
  shared = undefined;
}

/** A fresh lab and a fresh browser context; `arm` is posted before the start page loads, as the existing-Flow lane arms. */
export async function withSite<T>(run: (session: SiteSession) => Promise<T>, options: { arm?: { operation: string; payload?: unknown }; seed?: number } = {}): Promise<T> {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: options.seed ?? 4519 });
  const context = await (await browser()).newContext({ viewport: { width: 1280, height: 720 }, locale: "en-GB", timezoneId: "UTC" });
  try {
    if (options.arm) await mutate(lab, options.arm.operation, options.arm.payload ?? {});
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto(`${lab.origin}${START_PATH}`);
    return await run({ lab, page, context, consoleErrors });
  } finally {
    await context.close();
    await lab.close();
  }
}

export async function mutate(lab: RunningScenarioLab, operation: string, payload: unknown): Promise<void> {
  const response = await fetch(`${lab.origin}/api/${SCENARIO}/${operation}`, {
    method: "POST", headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`${operation} answered ${response.status}`);
}

export async function serverState(lab: RunningScenarioLab): Promise<CompanyWebsiteState> {
  const response = await fetch(`${lab.origin}/__control/final-state?scenario=${SCENARIO}`, { headers: { authorization: `Bearer ${lab.runToken}` } });
  return (await response.json() as { state: CompanyWebsiteState }).state;
}

/** Resolves a manifest target on the page. */
export function locate(page: Page, target: string): Locator {
  if (target.startsWith("testid:")) return page.locator(`[data-testid=${JSON.stringify(target.slice(7))}]`);
  if (target.startsWith("role:")) {
    const [role, ...name] = target.slice(5).split(":");
    return page.getByRole(role as Parameters<Page["getByRole"]>[0], name.length ? { name: name.join(":"), exact: true } : {});
  }
  if (target.startsWith("frame:")) {
    const body = target.slice(6);
    const at = body.indexOf("/");
    return page.frameLocator(`iframe[title=${JSON.stringify(body.slice(0, at))}]`).locator(body.slice(at + 1));
  }
  return page.locator(target);
}

/** Runs a recording script as the Lab's recording lane would, returning what each extract step read. */
export async function runScript(page: Page, steps: readonly ScenarioStep[]): Promise<Record<string, Array<Record<string, string>>>> {
  const extracted: Record<string, Array<Record<string, string>>> = {};
  for (const step of steps) {
    const timeout = step.timeoutMs ?? 10_000;
    try {
      switch (step.operation) {
        case "click": await locate(page, step.target!).click({ timeout }); break;
        case "type": await locate(page, step.target!).fill(String(step.value ?? ""), { timeout }); break;
        case "check": await locate(page, step.target!).setChecked(step.value === true, { timeout }); break;
        case "scroll": await page.mouse.wheel(0, Number(step.value ?? 500)); await page.waitForTimeout(300); break;
        case "waitForState": await locate(page, step.target!).waitFor({ state: "visible", timeout }); break;
        case "navigate": await page.goto(new URL(step.path!, page.url()).href); break;
        case "extract": extracted[step.id] = await extract(page, step); break;
        case "checkpoint": break;
        default: throw new Error(`site-driver does not run ${step.operation}`);
      }
    } catch (error) {
      throw new Error(`step ${step.id} failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  return extracted;
}

async function extract(page: Page, step: ScenarioStep): Promise<Array<Record<string, string>>> {
  const records: Array<Record<string, string>> = [];
  for (const item of await locate(page, step.target!).all()) {
    const record: Record<string, string> = {};
    for (const [name, spec] of Object.entries(step.fields ?? {})) {
      const value = spec.startsWith("column:") ? await column(item, spec.slice(7)) : await text(item.locator(spec).first());
      if (value !== undefined) record[name] = value;
    }
    records.push(record);
  }
  return records;
}

async function text(locator: Locator): Promise<string | undefined> {
  if (!await locator.count()) return undefined;
  return ((await locator.textContent()) ?? "").replace(/\s+/gu, " ").trim();
}

type PageCell = { textContent: string | null };
type PageRow = { cells: ArrayLike<PageCell>; closest(selector: string): { tHead: { rows: ArrayLike<PageRow> } | null } | null };

async function column(row: Locator, header: string): Promise<string | undefined> {
  return row.evaluate((element, wanted) => {
    const normalize = (value: string | null) => (value ?? "").replace(/\s+/gu, " ").trim();
    const tableRow = element as unknown as PageRow;
    const head = tableRow.closest("table")?.tHead?.rows[0];
    const index = head ? Array.from(head.cells).findIndex((cell) => normalize(cell.textContent) === wanted) : -1;
    const cell = tableRow.cells[index];
    return cell ? normalize(cell.textContent) : undefined;
  }, header);
}

/** Every fact that does not hold, as `id: expected / actual`; empty when all hold. */
export async function failedFacts(page: Page, facts: readonly ExpectedFact[]): Promise<string[]> {
  const failures: string[] = [];
  for (const fact of facts) {
    const subject = await firstSubject(page, fact.subject);
    let actual: unknown;
    if (fact.predicate === "text") actual = subject ? ((await subject.textContent()) ?? "").trim() : null;
    else if (fact.predicate === "contains") actual = subject ? (await subject.textContent()) ?? "" : null;
    else if (fact.predicate === "visible") actual = subject ? await subject.isVisible() : false;
    else if (fact.predicate === "exists") actual = subject !== undefined;
    else if (fact.predicate === "path") actual = new URL(page.url()).pathname;
    else if (fact.predicate === "iframe-count") actual = page.frames().length - 1;
    else throw new Error(`site-driver does not probe ${fact.predicate}`);
    const holds = fact.predicate === "contains" ? typeof actual === "string" && actual.includes(String(fact.value)) : actual === fact.value;
    if (!holds) failures.push(`${fact.id}: expected ${JSON.stringify(fact.value)}, saw ${JSON.stringify(actual)}`);
  }
  return failures;
}

async function firstSubject(page: Page, subject: string): Promise<Locator | undefined> {
  const frames: Frame[] = page.frames();
  for (const frame of frames) {
    const locator = frame.locator(`[data-testid=${JSON.stringify(subject)}]`).first();
    if (await locator.count()) return locator;
  }
  return undefined;
}

/** Console errors other than the rate limit's `429`, which every workflow allows. */
export function unexpectedConsoleErrors(errors: readonly string[]): string[] {
  return errors.filter((message) => !message.includes("status of 429"));
}
