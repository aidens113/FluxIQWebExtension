import type { Page } from "@playwright/test";
import { chooseLivePanelMode, type LivePanelOutcome } from "./choose-live-panel-mode.js";
import { openDockedPopup } from "./docked-popup.js";
import { openSidePanel } from "./side-panel.js";

export type OpenLivePanelOptions = {
  /** False when the run passed `--no-live-panel`. */
  enabled: boolean;
  /** A headless browser has no window to show a panel in, so nothing is tried. */
  headless: boolean;
  /** The fixture origin; the scenario tab is the one on it, never an extension page. */
  scenarioOrigin: string;
  /** How long each way may take to show the panel. */
  timeoutMs?: number;
  /** Where the one line naming the outcome goes. */
  log?: (line: string) => void;
};

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Shows the extension's panel beside the scenario page of a headed Lab run, so
 * the person watching sees what FluxIQ is doing while it does it.
 *
 * The real side panel first (`openSidePanel`), then a popup docked to the
 * right (`openDockedPopup`), and the mode that ran is returned for the run's
 * evidence and logged. It never throws: the panel is a view onto the run, not
 * part of what the run tests, so a panel that could not be shown is recorded as
 * mode `none` with the reason and the run goes on.
 *
 * Neither the side panel nor the popup is a scenario tab. Both are extension
 * pages, and every place a run picks "the scenario tab" selects by the fixture
 * origin, so `activateScenarioTab` and the page-picking assertions keep
 * choosing the fixture page.
 */
export async function openLivePanel(extensionPage: Page, options: OpenLivePanelOptions): Promise<LivePanelOutcome> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const outcome = await chooseLivePanelMode({ enabled: options.enabled, headless: options.headless }, {
    sidePanel: () => openSidePanel(extensionPage, options.scenarioOrigin, timeoutMs),
    popup: () => openDockedPopup(extensionPage, options.scenarioOrigin, timeoutMs),
  });
  options.log?.(`[lab] live panel: ${describe(outcome)}`);
  return outcome;
}

function describe(outcome: LivePanelOutcome): string {
  if (outcome.mode === "side-panel") return "side-panel (verified open)";
  if (outcome.mode === "popup") return `popup (side panel refused: ${outcome.sidePanelRefusal})`;
  return `${outcome.mode} (${outcome.reason})`;
}
