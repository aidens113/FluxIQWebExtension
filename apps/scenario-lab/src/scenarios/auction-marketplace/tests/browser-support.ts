import type { Locator, Page } from "@playwright/test";
import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";

type Scope = Page | Locator;
type AriaRole = Parameters<Page["getByRole"]>[0];

/**
 * A recording-script target, resolved the way the Lab's step runner resolves
 * one (`packages/test-runner/src/scenario-steps/locate-target.ts`): `testid:`
 * by `data-testid`, `role:<role>:<name>` by role and exact accessible name,
 * anything else as a Playwright selector.
 */
export function locate(scope: Scope, target: string): Locator {
  if (target.startsWith("testid:")) return scope.locator(`[data-testid=${JSON.stringify(target.slice("testid:".length))}]`);
  if (target.startsWith("role:")) {
    const body = target.slice("role:".length);
    const at = body.indexOf(":");
    const role = (at < 0 ? body : body.slice(0, at)) as AriaRole;
    return at < 0 ? scope.getByRole(role) : scope.getByRole(role, { name: body.slice(at + 1), exact: true });
  }
  return scope.locator(target);
}

function normalize(text: string | null): string {
  return (text ?? "").replace(/\s+/gu, " ").trim();
}

/** What an extract step reads: each item's fields as normalized text, a field whose element is absent left out, as the Lab's reference reader does. */
export async function readRecords(page: Page, step: ScenarioStep): Promise<Array<Record<string, string>>> {
  const records: Array<Record<string, string>> = [];
  for (const item of await locate(page, step.target!).all()) {
    const record: Record<string, string> = {};
    for (const [name, selector] of Object.entries(step.fields ?? {})) {
      const element = item.locator(selector).first();
      if (await element.count()) record[name] = normalize(await element.textContent());
    }
    records.push(record);
  }
  return records;
}

/** Performs one recording-script step as the Lab's step runner does, returning the records of an extract step. */
export async function runStep(page: Page, origin: string, step: ScenarioStep): Promise<Array<Record<string, string>> | undefined> {
  const timeout = step.timeoutMs ?? 10_000;
  switch (step.operation) {
    case "click": await locate(page, step.target!).click({ timeout }); return undefined;
    case "type": await locate(page, step.target!).fill(String(step.value ?? ""), { timeout }); return undefined;
    case "press": await locate(page, step.target!).press(String(step.value), { timeout }); return undefined;
    case "navigate": await page.goto(`${origin}${step.path!}`); return undefined;
    case "waitForState": await locate(page, step.target!).waitFor({ state: "visible", timeout }); return undefined;
    case "checkpoint": return undefined;
    case "extract": return readRecords(page, step);
    default: throw new Error(`The support runner has no ${step.operation} step`);
  }
}

/** Runs a whole script, returning the records of its extract steps by step id. */
export async function runScript(page: Page, origin: string, script: readonly ScenarioStep[]): Promise<Map<string, Array<Record<string, string>>>> {
  const extracted = new Map<string, Array<Record<string, string>>>();
  for (const step of script) {
    const records = await runStep(page, origin, step);
    if (records) extracted.set(step.id, records);
  }
  return extracted;
}

/**
 * The facts that do not hold on `page`, judged as the runner's fact probe
 * judges them (`scenario-assertions.ts`): by `data-testid` subject, `text` on
 * trimmed `textContent`, `exists` on presence, `visible` on visibility.
 */
export async function failingFacts(page: Page, facts: readonly ExpectedFact[]): Promise<Array<{ id: string; expected: unknown; actual: unknown }>> {
  const failing: Array<{ id: string; expected: unknown; actual: unknown }> = [];
  for (const fact of facts) {
    const element = page.locator(`[data-testid=${JSON.stringify(fact.subject)}]`).first();
    const present = (await element.count()) > 0;
    let actual: unknown;
    if (fact.predicate === "text") actual = present ? (await element.textContent())?.trim() ?? null : null;
    else if (fact.predicate === "exists") actual = present;
    else if (fact.predicate === "visible") actual = present ? await element.isVisible() : false;
    else throw new Error(`The support probe has no ${fact.predicate} predicate`);
    if (actual !== fact.value) failing.push({ id: fact.id, expected: fact.value, actual });
  }
  return failing;
}
