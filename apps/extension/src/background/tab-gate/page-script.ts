// Every script the extension injects into a page goes through here: the
// content script itself, and the scalar reads the runtime makes by injected
// function (served status, scheduled page work, a declared refresh). A tab
// showing FluxIQ's own page is refused before anything is injected.
//
// An injected function cannot ask the document's own decision the way a
// content command does (`content/own-document/`), so the tab is checked again
// once the injection returns: a tab that moved to FluxIQ's own page while it
// ran has its result discarded and refused, so nothing read there leaves this
// function. The content script injected into such a page refuses every command
// itself.

import { refuseOwnPageTab } from "./guard";

/** `chrome.scripting.executeScript`, once the target tab is known not to be FluxIQ's, before and after. */
export async function executeInTab<Args extends unknown[], Result>(injection: chrome.scripting.ScriptInjection<Args, Result>) {
  await refuseOwnPageTab(injection.target.tabId);
  const results = await chrome.scripting.executeScript(injection);
  await refuseOwnPageTab(injection.target.tabId);
  return results;
}
