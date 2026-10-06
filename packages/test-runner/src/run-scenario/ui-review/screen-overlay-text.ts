import { redactText } from "@fluxiq-web-extension/test-evidence";
import { screenLocation } from "./screen-location.js";

const MAX_TEXT = 300;
// What ends a location written in a sentence: space, a quote (straight or curly), a bracket.
const STOP = `\\s"'“”‘’<>()\\[\\]`;
// A URL with a scheme, or a path that begins a word ("/scenarios/…"), with its query and fragment if any.
const LOCATION = new RegExp(`([a-z][a-z0-9+.-]*://[^${STOP}]+)|((?<![^${STOP}])/(?:[^${STOP}?#/]+/?)+)((?:[?#][^${STOP}]*)?)`, "giu");

/**
 * The overlay's text as the review keeps it. A location the overlay names is
 * kept as `screenLocation` keeps a recorded one, origin and path, never query
 * or fragment, and a bare path the same way: "Opening “/scenarios/…/item/1”"
 * is what a reviewer needs to see. `screenText` turned that into
 * "Opening “[long]”" (run-musp8nz1, D14), because a long path is one run of
 * the characters it reads as an opaque string.
 *
 * Everything is still screened: the run's secrets and the evidence redactor's
 * token patterns everywhere, a six-digit pairing code everywhere, and outside
 * a location any 32-character opaque run.
 */
export function screenOverlayText(value: string, secrets: readonly string[]): string {
  const kept = secrets.filter(secret => secret.length > 0);
  const redacted = redactText(value, { secrets: kept });
  const opaque = (text: string) => text.replace(/[A-Za-z0-9+/_=-]{32,}/gu, "[long]");
  let screened = "";
  let from = 0;
  for (const match of redacted.matchAll(LOCATION)) {
    const at = match.index ?? 0;
    screened += opaque(redacted.slice(from, at));
    screened += match[1] !== undefined ? screenLocation(match[1], kept) : match[2] ?? "";
    from = at + match[0].length;
  }
  screened = (screened + opaque(redacted.slice(from))).replace(/\b\d{6}\b/gu, "[code]");
  return screened.length > MAX_TEXT ? `${screened.slice(0, MAX_TEXT)}…` : screened;
}
