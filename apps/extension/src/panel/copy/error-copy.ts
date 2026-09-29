// Raw error text to the sentence a person reads, from the table in the UI audit,
// section 4 ("Error sentences"). The raw text is not lost: a view keeps it for
// Advanced, Activity, and shows this sentence in the card the error belongs to.
//
// `undefined` means the background gave no answer at all -- the service worker
// was torn down (audit defect E2) -- so a caller passes it only for a missing
// reply, never for a status that simply has no `lastError`.

/** What a torn-down or restarted service worker reads as. */
export const EXTENSION_RESTARTED = "The extension restarted. Close this panel and open it again.";

const UNMAPPED = "Something went wrong.";

// What `chrome.runtime.sendMessage` rejects with when nothing is listening.
const NO_ANSWER = [
  "Could not establish connection. Receiving end does not exist.",
  "The message port closed before a response was received.",
  "Extension context invalidated."
];

// Already plain English, written for a person by the background: kept as written.
const PLAIN = new Set([
  "Connect to FluxIQ before recording.",
  "Open a FluxIQ project before recording.",
  "FluxIQ's project context went stale before recording could start.",
  "FluxIQ has a different project open than the one this recording asked for."
]);

/** The sentence to show for `raw`. */
export function errorSentence(raw: string | undefined): string {
  if (raw === undefined) return EXTENSION_RESTARTED;
  const text = raw.trim();
  if (NO_ANSWER.some((message) => text.startsWith(message))) return EXTENSION_RESTARTED;
  if (text === "WebSocket connection failed.") return "Can't reach FluxIQ. Make sure it is running on this computer.";
  if (/^FluxIQ recordings API returned 401\b/.test(text)) return "FluxIQ didn't accept this browser. Connect again to re-approve it.";
  if (/^FluxIQ recordings API returned \d+/.test(text)) return "Couldn't load recordings from FluxIQ.";
  if (PLAIN.has(text)) return text;
  return UNMAPPED;
}
