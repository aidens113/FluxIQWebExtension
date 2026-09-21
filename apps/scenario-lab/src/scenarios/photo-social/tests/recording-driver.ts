import type { Locator, Page } from "@playwright/test";
import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/**
 * Drives a recording script the way the Lab's step runner does, with the same
 * target grammar -- `testid:`, `role:<role>:<name>` with an exact name, or a raw
 * Playwright selector -- and the same strictness: a target matching two
 * elements fails the step rather than picking one. An `extract` step is read
 * the way the Lab's reference reader reads one: every item the target matches,
 * each field the first match inside it, text collapsed, `@attribute` read as
 * written.
 */
export function locate(page: Page, target: string): Locator {
  if (target.startsWith("testid:")) return page.locator(`[data-testid=${JSON.stringify(target.slice("testid:".length))}]`);
  if (target.startsWith("role:")) {
    const body = target.slice("role:".length);
    const separator = body.indexOf(":");
    const role = (separator < 0 ? body : body.slice(0, separator)) as Parameters<Page["getByRole"]>[0];
    return separator < 0 ? page.getByRole(role) : page.getByRole(role, { name: body.slice(separator + 1), exact: true });
  }
  return page.locator(target);
}

export type ExtractedRecord = Record<string, string>;

const normalize = (text: string | null) => (text ?? "").replace(/\s+/gu, " ").trim();

async function extract(page: Page, step: ScenarioStep): Promise<ExtractedRecord[]> {
  const records: ExtractedRecord[] = [];
  for (const item of await locate(page, step.target!).all()) {
    const record: ExtractedRecord = {};
    for (const [name, spec] of Object.entries(step.fields ?? {})) {
      const at = spec.lastIndexOf("@");
      const attribute = at >= 0 && /^[A-Za-z_][-A-Za-z0-9_:.]*$/u.test(spec.slice(at + 1)) ? spec.slice(at + 1) : undefined;
      const selector = attribute === undefined ? spec : spec.slice(0, at);
      const element = selector === "" ? item : item.locator(selector).first();
      if (await element.count() === 0) continue;
      record[name] = attribute === undefined ? normalize(await element.textContent()) : (await element.getAttribute(attribute)) ?? "";
    }
    records.push(record);
  }
  return records;
}

/** Runs `script` against `page` at `origin`, returning what each extract step read, by step id. */
export async function runScript(page: Page, origin: string, script: readonly ScenarioStep[]): Promise<Map<string, ExtractedRecord[]>> {
  const extracted = new Map<string, ExtractedRecord[]>();
  for (const step of script) {
    const timeout = step.timeoutMs ?? 5000;
    try {
      switch (step.operation) {
        case "click": await locate(page, step.target!).click({ timeout }); break;
        case "type": await locate(page, step.target!).fill(String(step.value ?? ""), { timeout }); break;
        case "navigate": await page.goto(`${origin}${step.path}`); break;
        case "waitForState": await locate(page, step.target!).waitFor({ state: "visible", timeout }); break;
        case "checkpoint": break;
        case "extract": extracted.set(step.id, await extract(page, step)); break;
        default: throw new Error(`the driver does not run ${step.operation}`);
      }
    } catch (error) {
      throw new Error(`step ${step.id} (${step.operation}) failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  return extracted;
}

/** What a fact's subject says on the page, read the way the Lab's probe reads it: the first element with that test id, its text trimmed. */
export async function factValue(page: Page, fact: ExpectedFact): Promise<unknown> {
  const subject = page.locator(`[data-testid=${JSON.stringify(fact.subject)}]`).first();
  if (fact.predicate === "text") return (await subject.count()) ? (await subject.textContent())?.trim() ?? null : null;
  if (fact.predicate === "exists") return (await subject.count()) > 0;
  if (fact.predicate === "visible") return (await subject.count()) > 0 && await subject.isVisible();
  throw new Error(`the driver does not read ${fact.predicate}`);
}
