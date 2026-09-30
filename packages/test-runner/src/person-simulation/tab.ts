import type { BrowserContext, Page } from "@playwright/test";

/**
 * One browser tab as the Lab's person uses it: look at what it shows, and do
 * the handful of things a person does at a check. Everything else about the
 * browser stays out, so the person's logic is tested without one
 * (`play-person-check.ts`).
 */
export type PersonTab = {
  /** Whether the tab is showing `text` now. A tab in the middle of loading shows nothing. */
  shows(text: string): Promise<boolean>;
  /** How many documents the tab has loaded since the person first looked at it. */
  loads(): number;
  /** Waits for the document now loading, if any, to finish. */
  settle(timeoutMs: number): Promise<void>;
  /** Brings the tab to the front, as a person looking at it would, so the page runs at full speed. */
  front(): Promise<void>;
  click(text: string): Promise<void>;
  pressAndHold(text: string, holdMs: number): Promise<void>;
  typeInto(label: string, value: string): Promise<void>;
  pressButton(name: string): Promise<void>;
};

/** How long one step may wait for its control. */
const STEP_TIMEOUT_MS = 5_000;

const tabs = new WeakMap<Page, PersonTab>();

/**
 * The tabs of `context` on the scenario's origin, newest first, as the capture
 * picks them (`run-scenario/window-capture/front-tab-source.ts`). Each page
 * keeps one adapter, so the loads it counts are counted from the first time
 * the person looked at it.
 */
export function scenarioTabs(context: BrowserContext, scenarioOrigin: string): PersonTab[] {
  return context.pages().filter((page) => !page.isClosed() && originOf(page.url()) === scenarioOrigin).reverse().map(personTabOf);
}

function personTabOf(page: Page): PersonTab {
  const known = tabs.get(page);
  if (known) return known;
  let loads = 0;
  page.on("load", () => { loads += 1; });
  const tab: PersonTab = {
    shows: async (text) => {
      try {
        return await page.getByText(text).first().isVisible();
      } catch (error) {
        // A tab navigating or closing as it is looked at is not showing anything at this instant; any other failure is the Lab's.
        if (page.isClosed() || /navigat|context was destroyed|closed|Target/iu.test(error instanceof Error ? error.message : String(error))) return false;
        throw error;
      }
    },
    loads: () => loads,
    settle: async (timeoutMs) => { await page.waitForLoadState("load", { timeout: timeoutMs }); },
    front: async () => { await page.bringToFront(); },
    click: async (text) => { await page.getByText(text).first().click({ timeout: STEP_TIMEOUT_MS }); },
    pressAndHold: async (text, holdMs) => {
      const target = page.getByText(text).first();
      await target.scrollIntoViewIfNeeded({ timeout: STEP_TIMEOUT_MS });
      const box = await target.boundingBox({ timeout: STEP_TIMEOUT_MS });
      if (!box) throw new Error("The control to hold has no box on screen");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(holdMs);
      await page.mouse.up();
    },
    typeInto: async (label, value) => { await page.getByLabel(label).first().fill(value, { timeout: STEP_TIMEOUT_MS }); },
    pressButton: async (name) => { await page.getByRole("button", { name }).first().click({ timeout: STEP_TIMEOUT_MS }); },
  };
  tabs.set(page, tab);
  return tab;
}

function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
