import type { Page } from "@playwright/test";
import type { LivePanelAttempt } from "./choose-live-panel-mode.js";

const POPUP_WIDTH = 420;
const SIDE_PANEL_PATH = "sidepanel/index.html";

/**
 * The fallback when the real side panel is refused: the same panel page in a
 * popup window docked to the right edge of the scenario's browser window.
 *
 * Two things here protect the run rather than the picture.
 *
 * The popup is created unfocused, so the browser window holding the scenario
 * tab stays the focused one.
 *
 * And the extension is handed the scenario tab back afterwards. The extension
 * takes whichever tab last fired `tabs.onActivated` or `tabs.onUpdated` as
 * active, and the popup's own tab fires both as it loads. `activateScenarioTab`
 * cannot undo that, because `chrome.tabs.update(id, { active: true })` on a tab
 * that is already active in its window fires no event at all, and the run would
 * then wait for a status the extension never reports. So once the popup has
 * loaded, another tab in the scenario's window is activated and then the
 * scenario tab again, which makes the scenario tab the last one activated.
 * Nothing is recording yet at this point, so the brief switch records nothing.
 */
export async function openDockedPopup(extensionPage: Page, scenarioOrigin: string, timeoutMs: number): Promise<LivePanelAttempt> {
  return extensionPage.evaluate(openDockedPopupInPage, { origin: scenarioOrigin, width: POPUP_WIDTH, panelPath: SIDE_PANEL_PATH, timeoutMs });
}

/** Runs in the extension control page. */
async function openDockedPopupInPage({ origin, width, panelPath, timeoutMs }: { origin: string; width: number; panelPath: string; timeoutMs: number }): Promise<LivePanelAttempt> {
  const chrome = (globalThis as any).chrome;
  const tabs: Array<{ id?: unknown; active?: boolean; windowId?: number }> = await chrome.tabs.query({ url: `${origin}/*` });
  const numbered = tabs.filter(tab => typeof tab.id === "number");
  const scenario = numbered.find(candidate => candidate.active) ?? numbered[0];
  if (!scenario || typeof scenario.windowId !== "number") return { ok: false, reason: `no scenario tab is open on ${origin}` };
  const scenarioTabId = scenario.id as number;
  const host: { left?: number; top?: number; width?: number; height?: number } = await chrome.windows.get(scenario.windowId);
  const screenWidth = (globalThis as any).screen?.availWidth;
  const rightEdge = (host.left ?? 0) + (host.width ?? 0);
  const left = typeof screenWidth === "number" && screenWidth > width ? Math.max(0, Math.min(rightEdge, screenWidth - width)) : rightEdge;
  const popup: { id?: number; tabs?: Array<{ id?: number }> } = await chrome.windows.create({ url: chrome.runtime.getURL(panelPath), type: "popup", focused: false, left, top: host.top ?? 0, width, ...(typeof host.height === "number" ? { height: host.height } : {}) });
  const popupTabId = popup.tabs?.[0]?.id;
  if (typeof popup.id !== "number" || typeof popupTabId !== "number") return { ok: false, reason: "chrome.windows.create returned no popup tab" };
  const loaded = await awaitPanelLoaded(popupTabId);
  // A popup that did not show the panel is closed rather than left behind.
  if (!loaded.ok) await chrome.windows.remove(popup.id);
  const siblings: Array<{ id?: unknown }> = await chrome.tabs.query({ windowId: scenario.windowId });
  const other = siblings.find(tab => typeof tab.id === "number" && tab.id !== scenarioTabId);
  if (other) await chrome.tabs.update(other.id, { active: true });
  await chrome.tabs.update(scenarioTabId, { active: true });
  return loaded;

  async function awaitPanelLoaded(tabId: number): Promise<LivePanelAttempt> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const tab: { status?: string; url?: string } = await chrome.tabs.get(tabId);
      if (tab.status === "complete") return (tab.url ?? "").endsWith(panelPath) ? { ok: true } : { ok: false, reason: `the popup loaded ${tab.url ?? "nothing"} instead of the panel` };
      if (Date.now() >= deadline) return { ok: false, reason: `the popup panel did not finish loading within ${timeoutMs} ms` };
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
