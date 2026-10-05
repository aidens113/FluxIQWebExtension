// The navigate parameter a dry run's reset asks the browser with: close the
// tabs FluxIQ's own clicks and tab opens left behind, and drive the tab they
// were opened from (t174-w93, cause 15 of `run-musp8nz1-dbd3905a`).
//
// A reset is a navigation only (`runtime/llm-evidence/node-run/replay.ts`),
// and a click on a `target="_blank"` link opens its page in a tab of its own,
// which the extension then drives (`apps/extension/src/runtime/click-landing.ts`).
// Each test of a build reset whichever tab was in front and pressed the link
// again, so every test left one more item tab open. The extension records the
// tabs it opened and closes only those; a person's tab is never in the record.
//
// It is not in the navigate schema a Flow is authored from: the gateway copies
// every parameter into the command's `options` (`./gateway-mapping.ts`), and the
// one sender of this key is the reset. A Flow cannot ask for it.

/** The `web.browser.navigate` parameter, read from the command's `options` by the extension (`runtime/command-options.ts`). */
export const WEB_AUTOMATION_CLOSE_OPENED_TABS_PARAMETER = "closeOpenedTabs";
