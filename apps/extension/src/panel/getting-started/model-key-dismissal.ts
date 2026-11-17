// Whether the person pressed "Not now" on the model-key reminder, remembered per FluxIQ server so
// it stays away across panel opens (a per-viewer convenience: browser storage, never required).
// Storage can be blocked or empty; then the answer lasts for this panel session only.

const PREFIX = "fluxiq.setup-card.dismissed:";
const session = new Set<string>();

/** True once the reminder was dismissed for `server`. */
export function isSetupDismissed(server: string): boolean {
  if (session.has(server)) return true;
  try {
    return globalThis.localStorage?.getItem(PREFIX + server) === "1";
  } catch {
    /* best-effort: blocked storage only means the reminder shows again */
    return false;
  }
}

/** Remembers the dismissal for `server`. */
export function dismissSetup(server: string): void {
  session.add(server);
  try {
    globalThis.localStorage?.setItem(PREFIX + server, "1");
  } catch {
    /* best-effort: session memory above still holds the answer */
  }
}
