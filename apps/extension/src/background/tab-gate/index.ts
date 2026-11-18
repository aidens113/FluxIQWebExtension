// The tab gate: the one module of the extension that reaches a browser tab.
// FluxIQ's own pages -- its web panel and the hosted sign-in routes it serves --
// are never read, acted in, switched to, scripted, captured or reported by the
// extension's automation. Every message, injected script, screenshot and tab act
// passes a check here first, and a refusal is a plain `OwnPageRefusal` error
// ("FluxIQ does not act in its own pages") that reaches the model as any
// browser failure does. `scripts/structure-audit/config.mjs` ("browser tab
// API") fails the audit on any `chrome.tabs` or `chrome.scripting` outside this
// directory, so a new call cannot go around it.

export { OwnPageRefusal } from "./refusal";
export { configureOwnPages, currentOwnPageAddresses, isOwnPage, isOwnPageTab, withoutOwnPages } from "./own-pages";
export type { OwnPageAddresses, OwnPageCandidate } from "./own-pages";
export { ownPageRefusalFor, refuseOwnPageTab } from "./guard";
export { sendTabMessage } from "./page-message";
export { executeInTab } from "./page-script";
export { captureWindow } from "./window-capture";
export { activateTab, closeTab, goBackInTab, navigateTab, openTab, openTabForPerson, reloadTab } from "./tab-acts";
export { tabReads } from "./tab-reads";
export type { TabReads } from "./tab-reads";
