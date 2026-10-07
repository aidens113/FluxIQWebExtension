import type { Page } from "@playwright/test";
import { activateScenarioTab } from "./activate-scenario-tab.js";

/** "build" for an exploration, "playback" for a created Flow's run, undefined for a run of the Flow built from this run's recording (and its repair replays). */
export type FlowTabMoment = "build" | "playback" | undefined;

export type PresentFlowTabInput = {
  /** The tab the runner opened the fixture in, which every Flow run is meant to land on. */
  page: Page;
  /** Every page of the browser context, the extension's own among them. */
  pages: readonly Page[];
  /** The extension page the runner drives it through; undefined when the run never paired. */
  extensionControl: Page | undefined;
  scenarioOrigin: string;
  isScenarioUrl: (url: string) => boolean;
  blankTabUrl: string;
  moment: FlowTabMoment;
  /** Whether `page` now shows the fixture's entry point, rather than the blank tab a Flow that reaches its own page starts on. */
  startsOnScenarioPage: boolean;
};

/**
 * Leaves `page` as the one tab a Flow run can land on, for every Flow run.
 *
 * The extension drives the tab that is in front (`apps/extension/src/background/connection/active-page.ts`),
 * not the tab the runner loaded the start page into. A recording that opens a
 * tab and switches to it ends with that tab in front, so a Flow built from it
 * ran on the tab the recording ended in: run-muykc54t-0cefc7eb
 * (crossborder-marketplace, 2026-10-07) reloaded the start page in `page`, left
 * the official listing's tab in front, and its first step waited three times
 * for the start page's welcome dialog on the listing page (`web.action.timeout`)
 * while the recording's own final state held. Created-Flow playback had closed
 * the other tabs since t267; the recording's Flow had not.
 *
 * So, for any moment but an exploration: every other fixture tab and every
 * blank tab is closed (the extension's own pages never are), and when the Flow
 * starts on the fixture page, `page` is brought to the front and the run waits
 * until the extension reports holding exactly that tab. Closing alone is not
 * enough: which tab Chrome activates next is its choice, and the extension's
 * status catches up only after the activation event. A Flow that starts on a
 * blank tab reaches its page as its own first step, so it is handed none.
 */
export async function presentFlowTab(input: PresentFlowTabInput): Promise<void> {
  if (input.moment === "build") return;
  const others = input.pages.filter(other => other !== input.page && other !== input.extensionControl && (input.isScenarioUrl(other.url()) || other.url() === input.blankTabUrl));
  for (const other of others) await other.close();
  if (!input.startsOnScenarioPage) return;
  await input.page.bringToFront();
  if (input.extensionControl) await activateScenarioTab(input.extensionControl, input.scenarioOrigin);
}
