/**
 * The browser-process lookup lives in `@fluxiq-web-extension/browser-host`, which
 * owns every `--user-data-dir` match; the Lab imports it from there.
 */
export { findBrowserProcess, type BrowserProcessEntry } from "@fluxiq-web-extension/browser-host/reaper";
