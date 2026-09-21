import { randomBytes } from "node:crypto";
import type { Browser, BrowserContext, FrameLocator, Locator, Page } from "@playwright/test";
import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import type { BigboxState } from "../types.js";

export type ExtractedRecord = Record<string, string>;
export type Harness = {
  lab: RunningScenarioLab;
  context: BrowserContext;
  page: Page;
  /** Every console error and page error the site raised, and every request that tried to leave loopback. */
  consoleErrors: string[];
  offLoopback: string[];
  state(): Promise<BigboxState>;
  arm(operation: string, payload: unknown): Promise<void>;
  open(path?: string): Promise<void>;
  close(): Promise<void>;
};

type Scope = Pick<Page, "locator" | "getByRole" | "frameLocator"> | Pick<FrameLocator, "locator" | "getByRole" | "frameLocator"> | Pick<Locator, "locator" | "getByRole" | "frameLocator">;

const LOOPBACK = new Set(["127.0.0.1", "localhost"]);
const DEFAULT_WAIT_MS = 10_000;

/** A fresh lab on its own run token, and a browser context that may reach only it, sized as the Lab sizes one. */
export async function openHarness(browser: Browser, seed = 239): Promise<Harness> {
  const runToken = randomBytes(24).toString("base64url");
  const lab = await startScenarioLab({ runToken, seed });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-US", timezoneId: "UTC" });
  const offLoopback: string[] = [];
  await context.route(/.*/u, (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || LOOPBACK.has(url.hostname)) return route.continue();
    offLoopback.push(url.href);
    return route.abort();
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  // The lab server answers /favicon.ico with a 404 for every scenario, and Chrome logs that once per context; it is not the site's.
  page.on("console", (message) => { if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  const control = (path: string, init: RequestInit = {}) => fetch(`${lab.origin}${path}`, { ...init, headers: { authorization: `Bearer ${runToken}`, "content-type": "application/json" } });
  return {
    lab, context, page, consoleErrors, offLoopback,
    state: async () => ((await (await control("/__control/final-state?scenario=bigbox-retail")).json()) as { state: BigboxState }).state,
    arm: async (operation, payload) => {
      const response = await control(`/api/bigbox-retail/${operation}`, { method: "POST", body: JSON.stringify(payload ?? {}) });
      if (!response.ok) throw new Error(`arming ${operation} answered ${response.status}`);
    },
    open: async (path = "") => { await page.goto(`${lab.origin}/scenarios/bigbox-retail/${path}`); },
    close: async () => { await context.close(); await lab.close(); },
  };
}

/** A manifest target, resolved exactly as the Lab's step runner resolves one. */
export function locate(scope: Scope, target: string): Locator {
  if (target.startsWith("testid:")) return scope.locator(`[data-testid=${JSON.stringify(target.slice("testid:".length))}]`);
  if (target.startsWith("role:")) {
    const body = target.slice("role:".length);
    const separator = body.indexOf(":");
    const role = (separator < 0 ? body : body.slice(0, separator)) as Parameters<Page["getByRole"]>[0];
    return separator < 0 ? scope.getByRole(role) : scope.getByRole(role, { name: body.slice(separator + 1), exact: true });
  }
  if (target.startsWith("frame:")) {
    const body = target.slice("frame:".length);
    const separator = body.indexOf("/");
    return locate(scope.frameLocator(`iframe[title=${JSON.stringify(body.slice(0, separator))}]`), body.slice(separator + 1));
  }
  return scope.locator(target);
}

const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();

async function readRecord(item: Locator, fields: Record<string, string>): Promise<ExtractedRecord> {
  const record: ExtractedRecord = {};
  for (const [name, spec] of Object.entries(fields)) {
    const at = spec.lastIndexOf("@");
    const attribute = at > 0 && /^[A-Za-z_][-A-Za-z0-9_:.]*$/u.test(spec.slice(at + 1)) ? spec.slice(at + 1) : undefined;
    const element = locate(item, attribute === undefined ? spec : spec.slice(0, at)).first();
    if (!await element.count()) continue;
    const value = attribute === undefined ? normalize((await element.textContent()) ?? "") : await element.getAttribute(attribute);
    if (value !== null) record[name] = value;
  }
  return record;
}

/** An extract step as the Lab's reader performs it: every item on the page, then Next until it is gone or the page cap is reached. */
export async function extractRecords(page: Page, step: Pick<ScenarioStep, "id" | "target" | "fields" | "pagination" | "timeoutMs">): Promise<ExtractedRecord[]> {
  const records: ExtractedRecord[] = [];
  const pagination = step.pagination && "next" in step.pagination ? step.pagination : undefined;
  for (let pageNumber = 1; ; pageNumber += 1) {
    const items = await locate(page, step.target!).all();
    for (const item of items) records.push(await readRecord(item, step.fields ?? {}));
    if (!pagination || pageNumber >= pagination.maxPages) return records;
    const next = locate(page, pagination.next);
    if (await next.count() === 0) return records;
    const marker = await (items[0] ?? next).elementHandle();
    await next.click({ timeout: step.timeoutMs ?? DEFAULT_WAIT_MS });
    const deadline = Date.now() + 15_000;
    while (await marker?.evaluate((node: { isConnected: boolean }) => node.isConnected).catch(() => false)) {
      if (Date.now() > deadline) throw new Error(`${step.id}: page ${pageNumber} was never replaced`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await page.waitForLoadState("domcontentloaded");
  }
}

/** Runs a recording script the way the recording lane drives one, returning each extract step's records by step id. */
export async function runSteps(harness: Harness, steps: readonly ScenarioStep[]): Promise<Map<string, ExtractedRecord[]>> {
  const { page } = harness;
  const extracted = new Map<string, ExtractedRecord[]>();
  for (const step of steps) {
    const timeout = step.timeoutMs ?? DEFAULT_WAIT_MS;
    const target = () => locate(page, step.target!);
    try {
      if (step.operation === "click") await target().click({ timeout });
      else if (step.operation === "type") await target().fill(String(step.value ?? ""), { timeout });
      else if (step.operation === "press") await target().press(String(step.value), { timeout });
      else if (step.operation === "select") await target().selectOption(String(step.value), { timeout });
      else if (step.operation === "check") await target().setChecked(step.value === true, { timeout });
      else if (step.operation === "waitForState") await target().waitFor({ state: "visible", timeout });
      else if (step.operation === "navigate") await page.goto(`${harness.lab.origin}${step.path}`);
      else if (step.operation === "extract") extracted.set(step.id, await extractRecords(page, step));
      else if (step.operation !== "checkpoint") throw new Error(`the harness does not drive ${step.operation}`);
    } catch (error) {
      throw new Error(`step ${step.id} (${step.operation} ${step.target ?? step.path ?? ""}) failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return extracted;
}

/** The ids of the facts that do not hold on `page`, checked as the Lab's fact probe checks them. */
export async function failingFacts(page: Page, facts: readonly ExpectedFact[]): Promise<string[]> {
  const failing: string[] = [];
  for (const fact of facts) {
    const subject = page.locator(`[data-testid=${JSON.stringify(fact.subject)}]`).first();
    const exists = await subject.count() > 0;
    let holds: boolean;
    if (fact.predicate === "text") holds = exists && ((await subject.textContent()) ?? "").trim() === fact.value;
    else if (fact.predicate === "exists") holds = exists === fact.value;
    else if (fact.predicate === "visible") holds = (exists && await subject.isVisible()) === fact.value;
    else throw new Error(`the harness does not check ${fact.predicate}`);
    if (!holds) failing.push(fact.id);
  }
  return failing;
}
