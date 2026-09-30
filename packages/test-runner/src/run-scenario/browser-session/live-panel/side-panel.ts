import type { Page } from "@playwright/test";
import type { LivePanelAttempt } from "./choose-live-panel-mode.js";

const BUTTON_ID = "fluxiq-lab-open-live-panel";
const STATE_KEY = "__fluxiqLabLivePanel";

/**
 * Opens the extension's real side panel beside the scenario tab, and answers
 * whether it is verifiably open.
 *
 * `chrome.sidePanel.open` is honoured only inside a user gesture, and it must
 * be called synchronously in the gesture's handler: an `await` before it loses
 * the gesture. So the extension control page is given a button whose click
 * handler calls it straight away with the scenario tab's id, fixed before the
 * click, and Playwright clicks that button. Playwright's click is real input
 * sent over CDP, which the browser treats as a trusted gesture; a script's
 * `button.click()` would not be.
 *
 * `open()` resolving is not taken as proof. The panel counts as open only when
 * `chrome.runtime.getContexts` reports a `SIDE_PANEL` context. The button is
 * removed again whatever happened.
 */
export async function openSidePanel(extensionPage: Page, scenarioOrigin: string, timeoutMs: number): Promise<LivePanelAttempt> {
  const armed = await extensionPage.evaluate(armSidePanelButton, { origin: scenarioOrigin, buttonId: BUTTON_ID, stateKey: STATE_KEY });
  if (!armed.ok) return armed;
  try {
    await extensionPage.locator(`#${BUTTON_ID}`).click({ force: true, timeout: timeoutMs });
    return await extensionPage.evaluate(awaitSidePanelContext, { stateKey: STATE_KEY, timeoutMs });
  } finally {
    await extensionPage.evaluate(removeSidePanelButton, { buttonId: BUTTON_ID, stateKey: STATE_KEY }).catch(/* best-effort: the button only sits unused in the control page */ () => undefined);
  }
}

type PanelState = { clicked: boolean; opened: boolean; error?: string };

/** Runs in the extension control page. */
async function armSidePanelButton({ origin, buttonId, stateKey }: { origin: string; buttonId: string; stateKey: string }): Promise<LivePanelAttempt> {
  const chrome = (globalThis as any).chrome;
  if (typeof chrome?.sidePanel?.open !== "function") return { ok: false, reason: "chrome.sidePanel.open is unavailable in this browser" };
  const tabs: Array<{ id?: unknown; active?: boolean }> = await chrome.tabs.query({ url: `${origin}/*` });
  const numbered = tabs.filter(tab => typeof tab.id === "number");
  const tab = numbered.find(candidate => candidate.active) ?? numbered[0];
  if (!tab) return { ok: false, reason: `no scenario tab is open on ${origin}` };
  const tabId = tab.id as number;
  const state: PanelState = { clicked: false, opened: false };
  (globalThis as any)[stateKey] = state;
  const button = document.createElement("button");
  button.id = buttonId;
  button.type = "button";
  button.textContent = "Open FluxIQ live panel";
  button.style.cssText = "position:fixed;top:0;left:0;z-index:2147483647;width:160px;height:32px;margin:0;opacity:0.01;";
  button.onclick = () => {
    state.clicked = true;
    // Synchronous on purpose: the gesture is lost at the first await.
    chrome.sidePanel.open({ tabId }).then(() => { state.opened = true; }, (error: unknown) => { state.error = error instanceof Error ? error.message : String(error); });
  };
  document.body.append(button);
  return { ok: true };
}

/** Runs in the extension control page. */
async function awaitSidePanelContext({ stateKey, timeoutMs }: { stateKey: string; timeoutMs: number }): Promise<LivePanelAttempt> {
  const chrome = (globalThis as any).chrome;
  const state = (globalThis as any)[stateKey] as PanelState | undefined;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (state?.error !== undefined) return { ok: false, reason: `chrome.sidePanel.open refused: ${state.error}` };
    if (state?.opened) {
      if (typeof chrome?.runtime?.getContexts !== "function") return { ok: false, reason: "chrome.runtime.getContexts is unavailable, so the side panel cannot be verified" };
      const contexts: unknown[] = await chrome.runtime.getContexts({ contextTypes: ["SIDE_PANEL"] });
      if (contexts.length > 0) return { ok: true };
    }
    if (Date.now() >= deadline) {
      if (!state?.clicked) return { ok: false, reason: "the click never reached the control page's button" };
      if (!state.opened) return { ok: false, reason: `chrome.sidePanel.open did not settle within ${timeoutMs} ms` };
      return { ok: false, reason: `chrome.sidePanel.open resolved but no SIDE_PANEL context appeared within ${timeoutMs} ms` };
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/** Runs in the extension control page. */
function removeSidePanelButton({ buttonId, stateKey }: { buttonId: string; stateKey: string }): void {
  document.getElementById(buttonId)?.remove();
  delete (globalThis as any)[stateKey];
}
