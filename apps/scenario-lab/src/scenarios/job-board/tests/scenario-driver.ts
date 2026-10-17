import { setTimeout as delay } from "node:timers/promises";
import type { BrowserContext, FrameLocator, Locator, Page } from "@playwright/test";
import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

type Role = Parameters<Page["getByRole"]>[0];
type Records = Array<Record<string, string | null>>;

/**
 * A manifest step runner with the recording lane's target grammar (test ids,
 * roles with exact names, frames by title, CSS), for the job board's browser
 * specs: each honest path is a manifest recording run through it.
 */
export class Driver {
  active: Page;
  readonly extracted = new Map<string, Records>();
  constructor(private readonly context: BrowserContext, page: Page) { this.active = page; }

  locate(target: string): Locator {
    if (!target.startsWith("frame:")) return scoped(this.active, target);
    const body = target.slice("frame:".length);
    const slash = body.indexOf("/");
    return scoped(this.active.frameLocator(`iframe[title="${body.slice(0, slash)}"]`), body.slice(slash + 1));
  }

  async run(script: readonly ScenarioStep[]): Promise<void> {
    for (const step of script) {
      try { await this.perform(step); } catch (error) { throw new Error(`step ${step.id} failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`); }
    }
  }

  private async perform(step: ScenarioStep): Promise<void> {
    const target = () => this.locate(step.target ?? "");
    switch (step.operation) {
      case "click": return target().click({ timeout: 8000 });
      case "navigate": {
        await this.active.goto(new URL(step.path!, this.active.url()).href);
        return;
      }
      case "type": return target().fill(String(step.value), { timeout: 8000 });
      case "select": {
        await target().selectOption(String(step.value), { timeout: 8000 });
        return;
      }
      case "check": return target().setChecked(step.value === true, { timeout: 8000 });
      case "waitForState": return target().first().waitFor({ state: "visible", timeout: step.timeoutMs ?? 5000 });
      case "checkpoint": return;
      case "switchTab": {
        const deadline = Date.now() + (step.timeoutMs ?? 5000);
        for (;;) {
          const page = this.context.pages().find((candidate) => new URL(candidate.url()).pathname === step.path);
          if (page) {
            await page.waitForLoadState("domcontentloaded");
            this.active = page;
            return;
          }
          if (Date.now() > deadline) throw new Error(`no tab at ${step.path}`);
          await delay(100);
        }
      }
      case "extract": {
        const items = target();
        const records: Records = [];
        for (let index = 0; index < await items.count(); index += 1) {
          const record: Record<string, string | null> = {};
          for (const [name, spec] of Object.entries(step.fields ?? {})) {
            const at = spec.lastIndexOf("@");
            const selector = at < 0 ? spec : spec.slice(0, at);
            const element = selector ? items.nth(index).locator(selector).first() : items.nth(index);
            record[name] = at < 0 ? ((await element.textContent()) ?? "").replace(/\s+/gu, " ").trim() : await element.getAttribute(spec.slice(at + 1));
          }
          records.push(record);
        }
        this.extracted.set(step.id, records);
        return;
      }
      default: throw new Error(`the job-board driver does not run ${step.operation}`);
    }
  }
}

function scoped(scope: Page | FrameLocator, target: string): Locator {
  if (target.startsWith("testid:")) return scope.getByTestId(target.slice("testid:".length));
  if (target.startsWith("role:")) {
    const body = target.slice("role:".length);
    const colon = body.indexOf(":");
    return colon < 0 ? scope.getByRole(body as Role) : scope.getByRole(body.slice(0, colon) as Role, { name: body.slice(colon + 1), exact: true });
  }
  return scope.locator(target);
}
