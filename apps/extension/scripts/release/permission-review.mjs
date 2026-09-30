// The reviewed permission set for the store builds (Chrome/Edge and Firefox).
//
// Every permission a store manifest asks for must appear here with the reason
// the product needs it, and `verifyExtensionTarget` fails a build that asks for
// anything else. Adding a permission therefore means adding its justification
// in the same change, which is what a store reviewer will ask for anyway. The
// user-facing copy of this review is docs/user/permissions.md; keep the two in
// step.
//
// Reviewed 2026-09-29 (t183) against the call sites in apps/extension/src.
// Nothing here could be narrowed without breaking a shipped behaviour; the
// reasons say which one.

/** @typedef {{ readonly permission: string, readonly targets: readonly ("chrome" | "firefox")[], readonly installWarning: string, readonly usedBy: string, readonly why: string }} ReviewedPermission */

/** @type {readonly ReviewedPermission[]} */
export const REVIEWED_PERMISSIONS = Object.freeze([
  {
    permission: "<all_urls>",
    targets: ["chrome", "firefox"],
    installWarning: "Read and change all your data on all websites",
    usedBy: "host_permissions; both content_scripts entries; chrome.tabs.captureVisibleTab (background/connection/state-assets.ts)",
    why: "FluxIQ records and runs automations on whatever site the user chooses, so the recorder must already be in every frame at document_start when a recording or run begins. A fixed host list cannot be known in advance, and optional host permissions would miss the page load that the recording has to observe. Nothing is sent anywhere except the FluxIQ runtime the user connects to."
  },
  {
    permission: "activeTab",
    targets: ["chrome", "firefox"],
    installWarning: "none",
    usedBy: "the toolbar action",
    why: "Keeps the current tab usable when the user restricts site access to \"on click\" (Chrome) or has not yet granted the optional host permission (Firefox MV3, where <all_urls> is opt-in)."
  },
  {
    permission: "alarms",
    targets: ["chrome", "firefox"],
    installWarning: "none",
    usedBy: "background/reconnect-watchdog.ts (one periodic alarm, cleared once connected)",
    why: "A service worker the browser has stopped cannot hold a timer, so after an extension reload or browser restart nothing would reconnect the extension to its FluxIQ runtime. One alarm wakes the worker to retry the connection and is cleared as soon as it connects. It reads nothing."
  },
  {
    permission: "downloads",
    targets: ["chrome", "firefox"],
    installWarning: "Manage your downloads",
    usedBy: "runtime/browser-download.ts (chrome.downloads.search and onChanged only)",
    why: "A flow step that saves a file is verified by observing that the download completed. The extension never starts, opens or deletes a download, and never reads file contents. Without it the step fails with a named permission error rather than passing unverified."
  },
  {
    permission: "scripting",
    targets: ["chrome", "firefox"],
    installWarning: "none beyond host access",
    usedBy: "background/tabs.ts (reinject content/index.js into a frame); runtime/click-landing.ts (read the served HTTP status after a click)",
    why: "Tabs that were open before the extension was installed or updated have no content script; reinjection is what lets the first run work without reloading them."
  },
  {
    permission: "storage",
    targets: ["chrome", "firefox"],
    installWarning: "none",
    usedBy: "chrome.storage.local and chrome.storage.session",
    why: "Keeps the connection address, pairing state and panel preferences on this device."
  },
  {
    permission: "tabs",
    targets: ["chrome", "firefox"],
    installWarning: "Read your browsing history",
    usedBy: "background/tabs.ts, background/connection/* (tabs.query/get/create/reload/remove, onUpdated/onActivated/onRemoved)",
    why: "Automations open, switch, reload and close tabs, and the runtime is told which tab and URL a step ran in."
  },
  {
    permission: "webNavigation",
    targets: ["chrome", "firefox"],
    installWarning: "Read your browsing history",
    usedBy: "background/connection/* (getAllFrames, onBeforeNavigate, onCommitted, onErrorOccurred, onHistoryStateUpdated)",
    why: "Knowing every frame and when a navigation starts, commits or fails is how a step targets an element inside an iframe and how a run tells a slow page from a failed one."
  },
  {
    permission: "sidePanel",
    targets: ["chrome"],
    installWarning: "none",
    usedBy: "background/index.ts (sidePanel.setPanelBehavior)",
    why: "The FluxIQ panel opens in Chrome's side panel. Firefox has no side panel API and uses the toolbar popup instead."
  }
]);
