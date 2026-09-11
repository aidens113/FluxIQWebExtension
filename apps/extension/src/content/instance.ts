// A page can end up with several injected copies of the content script -- a
// re-injection after a navigation, or a second extension reload. The newest
// copy claims the window on load and every older copy falls silent, so the
// background worker never receives the same event twice.

const ACTIVE_CONTENT_INSTANCE_KEY = "__fluxiqWebAutomationActiveContentInstance";

/** Bumped when the content script gains behaviour the background worker must detect. */
export const CONTENT_SCRIPT_VERSION = 2;

export const CONTENT_INSTANCE_ID = `${Date.now()}.${Math.random().toString(36).slice(2)}`;

const contentWindow = window as Window & { [ACTIVE_CONTENT_INSTANCE_KEY]?: string };
contentWindow[ACTIVE_CONTENT_INSTANCE_KEY] = CONTENT_INSTANCE_ID;

export function isActiveContentInstance(): boolean {
  return contentWindow[ACTIVE_CONTENT_INSTANCE_KEY] === CONTENT_INSTANCE_ID;
}
