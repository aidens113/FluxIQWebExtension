// Every act the extension's automation takes on a tab: open, navigate, reload,
// go back, bring to the front, close. A tab showing FluxIQ's own page is never
// acted on, and no tab is opened or driven to one: the panel is the person's,
// and a run is usually started from it.
//
// `openTabForPerson` is the one way to open a FluxIQ page, and only the
// extension's own panel controls reach it (`background/panel/`), when the person
// asks to see their projects, keys or data there.

import { refuseOwnPageTab } from "./guard";
import { isOwnPage } from "./own-pages";
import { OwnPageRefusal } from "./refusal";

/** Brings the tab to the front of its window. */
export async function activateTab(tabId: number): Promise<chrome.tabs.Tab> {
  await refuseOwnPageTab(tabId);
  return await chrome.tabs.update(tabId, { active: true });
}

/** Drives the tab to `url`, fronting it. Neither the tab nor the address may be FluxIQ's. */
export async function navigateTab(tabId: number, url: string): Promise<chrome.tabs.Tab> {
  if (isOwnPage(url)) throw new OwnPageRefusal(undefined);
  await refuseOwnPageTab(tabId);
  return await chrome.tabs.update(tabId, { url, active: true });
}

/** Reloads the tab's page. */
export async function reloadTab(tabId: number): Promise<void> {
  await refuseOwnPageTab(tabId);
  await chrome.tabs.reload(tabId);
}

/** Takes the tab back one history entry. */
export async function goBackInTab(tabId: number): Promise<void> {
  await refuseOwnPageTab(tabId);
  await chrome.tabs.goBack(tabId);
}

/** Closes the tab. */
export async function closeTab(tabId: number): Promise<void> {
  await refuseOwnPageTab(tabId);
  await chrome.tabs.remove(tabId);
}

/** Opens a tab, at `url` when one is given; never at one of FluxIQ's own pages. */
export async function openTab(properties: { url?: string | undefined; active: boolean }): Promise<chrome.tabs.Tab> {
  if (properties.url !== undefined && isOwnPage(properties.url)) throw new OwnPageRefusal(undefined);
  return await chrome.tabs.create({ ...(properties.url !== undefined ? { url: properties.url } : {}), active: properties.active });
}

/**
 * Opens a page the person asked for from the extension's own panel -- a FluxIQ
 * page among them. Never for automation: nothing a model or a Flow sends
 * reaches it.
 */
export async function openTabForPerson(url: string): Promise<void> {
  await chrome.tabs.create({ url, active: true });
}
