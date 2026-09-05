import type { Frame, Locator, Page } from "@playwright/test";
import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "./failure.js";

export type ScenarioFactProbe = {
  text(subject: string): Promise<string | null>;
  visible(subject: string): Promise<boolean>;
  exists(subject: string): Promise<boolean>;
  enabled(subject: string): Promise<boolean>;
  path(): Promise<string>;
  iframeCount(): Promise<number>;
  labelCount(label: string): Promise<number>;
};

export async function assertExpectedFacts(facts: readonly ExpectedFact[], probe: ScenarioFactProbe): Promise<void> {
  for (const fact of facts) {
    let actual: unknown;
    if (fact.predicate === "text") actual = (await probe.text(fact.subject))?.trim() ?? null;
    else if (fact.predicate === "contains") {
      const text = await probe.text(fact.subject);
      const expected = expectedString(fact.value, fact.id);
      if (text === null || !text.includes(expected)) fail(fact, text);
      continue;
    } else if (fact.predicate === "visible") actual = await probe.visible(fact.subject);
    else if (fact.predicate === "exists") actual = await probe.exists(fact.subject);
    else if (fact.predicate === "enabled") actual = await probe.enabled(fact.subject);
    else if (fact.predicate === "path") actual = await probe.path();
    else if (fact.predicate === "iframe-count") actual = await probe.iframeCount();
    else if (fact.predicate.startsWith("label-count:")) actual = await probe.labelCount(fact.predicate.slice("label-count:".length));
    else throw new RunnerFailure("runtime.behavior", `Unsupported scenario fact predicate: ${fact.predicate}`);

    const expected = expectedValue(fact);
    if (actual !== expected) fail(fact, actual);
  }
}

export function playwrightScenarioFactProbe(page: Page): ScenarioFactProbe {
  return {
    async text(subject) {
      const frame = await childFrameByTestId(page, subject);
      if (frame) {
        const result = frame.locator('[data-testid="frame-result"], [data-testid="result"]').first();
        return await result.count() ? result.textContent() : null;
      }
      const locator = await firstSubjectLocator(page, subject);
      return locator ? locator.textContent() : null;
    },
    async visible(subject) { const locator = await firstSubjectLocator(page, subject); return locator ? locator.isVisible() : false; },
    async exists(subject) { return Boolean(await firstSubjectLocator(page, subject)); },
    async enabled(subject) { const locator = await firstSubjectLocator(page, subject); return locator ? locator.isEnabled() : false; },
    async path() { return new URL(page.url()).pathname; },
    async iframeCount() { return Math.max(0, page.frames().length - 1); },
    async labelCount(label) {
      let count = 0;
      for (const frame of page.frames()) count += await frame.locator("label").filter({ hasText: label }).count();
      return count;
    },
  };
}

async function firstSubjectLocator(page: Page, subject: string): Promise<Locator | undefined> {
  const selector = `[data-testid=${JSON.stringify(subject)}]`;
  for (const frame of page.frames()) {
    const locator = frame.locator(selector).first();
    if (await locator.count()) return locator;
  }
  return undefined;
}

async function childFrameByTestId(page: Page, subject: string): Promise<Frame | undefined> {
  for (const frame of page.frames().slice(1)) {
    const element = await frame.frameElement().catch(() => undefined);
    if (element && await element.getAttribute("data-testid").catch(() => null) === subject) return frame;
  }
  return undefined;
}

function expectedValue(fact: ExpectedFact): unknown {
  if (["visible", "exists", "enabled"].includes(fact.predicate)) {
    if (typeof fact.value !== "boolean") throw new RunnerFailure("runtime.behavior", `Scenario fact ${fact.id} requires a boolean value`);
    return fact.value;
  }
  if (fact.predicate === "iframe-count" || fact.predicate.startsWith("label-count:")) {
    if (typeof fact.value !== "number" || !Number.isSafeInteger(fact.value) || fact.value < 0) throw new RunnerFailure("runtime.behavior", `Scenario fact ${fact.id} requires a non-negative integer value`);
    return fact.value;
  }
  return expectedString(fact.value, fact.id);
}

function expectedString(value: unknown, id: string): string {
  if (typeof value !== "string") throw new RunnerFailure("runtime.behavior", `Scenario fact ${id} requires a string value`);
  return value;
}

function fail(fact: ExpectedFact, actual: unknown): never {
  throw new RunnerFailure("runtime.behavior", `Scenario fact failed: ${fact.id}`, { details: { factId: fact.id, predicate: fact.predicate, expected: fact.value, actual } });
}
