import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { MARKET_SEED } from "../manifest/index.js";

/**
 * A real browser against a real lab, for the paths that only a browser can
 * judge: what a click at a point lands on, what a lazy grid holds after a
 * scroll, what a frame and a shadow root do. Each session owns its own lab, so
 * sessions run side by side without sharing a cart.
 *
 * `run` executes manifest steps the way the Lab's recording lane does
 * (`packages/test-runner/src/scenario-steps/step-runner.ts`): a target is a
 * test id, a `frame:` target, or a raw Playwright selector; `type` fills;
 * `switchTab` moves to the open tab whose path matches; `extract` reads each
 * matched item's fields as normalised text, leaving out a field whose element
 * is absent.
 */
export type Session = {
  lab: RunningScenarioLab;
  context: BrowserContext;
  /** The tab the steps act on; `switchTab` moves it. */
  page: Page;
  /** Uncaught page errors and console errors, in order. */
  errors: string[];
  run(steps: readonly ScenarioStep[]): Promise<Record<string, Array<Record<string, string>>>>;
  /** The facts that do not hold on the active tab, each as `id: actual`. */
  failingFacts(facts: readonly ExpectedFact[]): Promise<string[]>;
  arm(mode: string): Promise<void>;
  finalState(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
};

const STEP_TIMEOUT_MS = 12_000;

let browser: Promise<Browser> | undefined;

export async function openSession(): Promise<Session> {
  // Full Chromium in headless mode, as `e2e/playwright.config.ts` launches it: the separate headless shell crashes on launch on this Windows host.
  browser ??= chromium.launch({ headless: true, channel: "chromium" });
  const runToken = `t042-${Math.random().toString(36).slice(2, 12)}-browser`;
  const lab = await startScenarioLab({ runToken, seed: MARKET_SEED });
  const context = await (await browser).newContext({ viewport: { width: 1280, height: 720 }, locale: "en-US", timezoneId: "UTC" });
  const errors: string[] = [];
  const watch = (page: Page) => {
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()} @ ${message.location().url}`); });
  };
  context.on("page", watch);
  context.on("response", (response) => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${new URL(response.url()).pathname}`); });
  const first = await context.newPage();
  const session: Session = {
    lab, context, page: first, errors,
    async run(steps) {
      const extracted: Record<string, Array<Record<string, string>>> = {};
      for (const step of steps) {
        try {
          const records = await perform(session, step);
          if (records) extracted[step.id] = records;
        } catch (error) {
          throw new Error(`Step ${step.id} (${step.operation}) failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`, { cause: error });
        }
      }
      return extracted;
    },
    async failingFacts(facts) {
      const failing: string[] = [];
      for (const fact of facts) {
        const actual = await probe(session.page, fact);
        if (actual !== fact.value) failing.push(`${fact.id}: ${JSON.stringify(actual)}`);
      }
      return failing;
    },
    async arm(mode) {
      const response = await fetch(`${lab.origin}/api/crossborder-marketplace/set-mode`, { method: "POST", headers: { authorization: `Bearer ${runToken}`, "content-type": "application/json" }, body: JSON.stringify({ mode }) });
      if (!response.ok) throw new Error(`Arming ${mode} failed: ${response.status}`);
    },
    async finalState() {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=crossborder-marketplace`, { headers: { authorization: `Bearer ${runToken}` } });
      return ((await response.json()) as { state: Record<string, unknown> }).state;
    },
    async close() {
      await context.close();
      await lab.close();
    },
  };
  await first.goto(`${lab.origin}/scenarios/crossborder-marketplace/`);
  return session;
}

export async function closeBrowser(): Promise<void> {
  if (browser) await (await browser).close();
  browser = undefined;
}

/** A manifest target on the active tab, resolved as the Lab resolves it. */
export function locate(page: Page, target: string): Locator {
  if (target.startsWith("testid:")) return page.locator(`[data-testid=${JSON.stringify(target.slice("testid:".length))}]`);
  if (target.startsWith("frame:")) {
    const body = target.slice("frame:".length);
    const separator = body.indexOf("/");
    return page.frameLocator(`iframe[title=${JSON.stringify(body.slice(0, separator))}]`).locator(body.slice(separator + 1));
  }
  return page.locator(target);
}

async function perform(session: Session, step: ScenarioStep): Promise<Array<Record<string, string>> | undefined> {
  const page = session.page;
  const timeout = step.timeoutMs ?? STEP_TIMEOUT_MS;
  const target = () => locate(page, step.target ?? "");
  switch (step.operation) {
    case "click": await target().click({ timeout }); return undefined;
    case "type": await target().fill(String(step.value ?? ""), { timeout }); return undefined;
    case "press": await target().press(String(step.value), { timeout }); return undefined;
    case "waitForState": await target().waitFor({ state: "visible", timeout }); return undefined;
    case "scroll": await page.mouse.wheel(0, Number(step.value ?? 500)); await page.waitForTimeout(300); return undefined;
    case "checkpoint": return undefined;
    case "switchTab": session.page = await switchTab(session.context, step.path ?? "", timeout); return undefined;
    case "extract": return extract(page, step);
    default: throw new Error(`The harness does not drive ${step.operation}`);
  }
}

async function switchTab(context: BrowserContext, pathname: string, timeoutMs: number): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const page = [...context.pages()].reverse().find((candidate) => !candidate.isClosed() && new URL(candidate.url(), "http://x").pathname === pathname);
    if (page) { await page.waitForLoadState("domcontentloaded"); await page.bringToFront(); return page; }
    if (Date.now() >= deadline) throw new Error(`No tab opened ${pathname}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function extract(page: Page, step: ScenarioStep): Promise<Array<Record<string, string>>> {
  const records: Array<Record<string, string>> = [];
  for (const item of await locate(page, step.target ?? "").all()) {
    const record: Record<string, string> = {};
    for (const [name, selector] of Object.entries(step.fields ?? {})) {
      const element = item.locator(selector).first();
      if (await element.count()) record[name] = normalize(await element.textContent());
    }
    records.push(record);
  }
  return records;
}

export function normalize(text: string | null): string {
  return (text ?? "").replace(/\s+/gu, " ").trim();
}

/** What the Lab's fact probe reads for one fact on the active tab (`packages/test-runner/src/scenario-assertions.ts`). */
async function probe(page: Page, fact: ExpectedFact): Promise<unknown> {
  const element = page.locator(`[data-testid=${JSON.stringify(fact.subject)}]`).first();
  const present = (await element.count()) > 0;
  if (fact.predicate === "exists") return present;
  if (fact.predicate === "visible") return present && await element.isVisible();
  if (fact.predicate === "text") return present ? (await element.textContent())?.trim() ?? null : null;
  throw new Error(`The harness does not probe ${fact.predicate}`);
}
