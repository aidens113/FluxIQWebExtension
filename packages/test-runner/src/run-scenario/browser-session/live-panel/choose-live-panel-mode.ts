/** What one way of showing the panel reported: it showed, or why it did not. */
export type LivePanelAttempt = { ok: true } | { ok: false; reason: string };

/**
 * Which live panel a run showed beside its scenario page.
 *
 * - `side-panel`: the extension's real side panel, verified open.
 * - `popup`: the side panel was refused, so the panel page was opened in a
 *   popup window docked to the right of the browser window.
 * - `none`: both were tried and neither showed; `reason` names both failures.
 * - `skipped`: nothing was tried, because the browser is headless or the run
 *   passed `--no-live-panel`.
 */
export type LivePanelOutcome =
  | { mode: "side-panel" }
  | { mode: "popup"; sidePanelRefusal: string }
  | { mode: "none"; reason: string }
  | { mode: "skipped"; reason: "headless" | "--no-live-panel" };

export type LivePanelChoice = { enabled: boolean; headless: boolean };
export type LivePanelOpeners = { sidePanel: () => Promise<LivePanelAttempt>; popup: () => Promise<LivePanelAttempt> };

/**
 * Tries the real side panel, then the docked popup, and answers which one ran.
 *
 * It never throws. The panel is there for the person watching a headed run; a
 * run whose panel did not open is still a valid run of the scenario, so an
 * opener that throws is recorded as a refusal with its message and the next
 * way is tried.
 */
export async function chooseLivePanelMode(choice: LivePanelChoice, openers: LivePanelOpeners): Promise<LivePanelOutcome> {
  if (!choice.enabled) return { mode: "skipped", reason: "--no-live-panel" };
  if (choice.headless) return { mode: "skipped", reason: "headless" };
  const sidePanel = await attempt(openers.sidePanel);
  if (sidePanel.ok) return { mode: "side-panel" };
  const popup = await attempt(openers.popup);
  if (popup.ok) return { mode: "popup", sidePanelRefusal: sidePanel.reason };
  return { mode: "none", reason: `side panel: ${sidePanel.reason}; popup: ${popup.reason}` };
}

async function attempt(open: () => Promise<LivePanelAttempt>): Promise<LivePanelAttempt> {
  try {
    return await open();
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
