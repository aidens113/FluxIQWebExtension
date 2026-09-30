// What a failure's text may carry into a problem report.
//
// A failure sentence is written by whoever failed -- the socket, Core, the
// content script, a stored-state reader -- and any of them may quote what it was
// handed: a page address with a session in its query, a value typed into a
// field, a header. A problem report leaves the machine, so its text is cut down
// to what diagnoses a failure without carrying the data the failure was about.
//
// The rule is deliberately blunt, because it runs on text nobody here wrote:
//
// - every literal the caller names (the pairing token, the pairing code) is
//   withheld wherever it appears;
// - a URL keeps its origin, which says which server failed, and loses its path,
//   query and fragment, which say what page and whose session;
// - a bearer credential, and the value of any `key=value` or `key: value`
//   whose key names a token, password, secret, cookie, session, auth or API key,
//   is withheld;
// - quoted text is withheld, because a failure quotes exactly the value it could
//   not use ("Could not type "hunter2" into #password");
// - an e-mail address, and a run of eight or more digits (a card or account
//   number, with spaces or dashes), is withheld;
// - the result is cut to `MAXIMUM_DIAGNOSTIC_TEXT_LENGTH` characters.
//
// It loses detail on purpose. A report that needs a quoted value to be
// understood is one to reproduce, not one to ship the value in.

export const DIAGNOSTIC_WITHHELD = "[withheld]";
export const MAXIMUM_DIAGNOSTIC_TEXT_LENGTH = 300;

const URL_PATTERN = /\b([a-z][a-z0-9+.-]*):\/\/([^\s/?#"'<>]+)[^\s"'<>]*/gi;
const BEARER_PATTERN = /\b(bearer|basic)\s+[^\s,;"']+/gi;
const SECRET_ASSIGNMENT_PATTERN = /\b([\w.-]*(?:token|password|passwd|secret|cookie|session|auth|api[_-]?key|credential)[\w.-]*)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)/gi;
// A single-quoted span must open and close outside a word, so an apostrophe
// ("can't", "FluxIQ's") is not read as a quote.
const QUOTED_PATTERN = /"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|(?<!\w)'[^'\n]+'(?!\w)/g;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const LONG_NUMBER_PATTERN = /\d(?:[ -]?\d){7,}/g;

export function redactDiagnosticText(text: string, literals: readonly (string | undefined)[] = []): string {
  let result = text;
  for (const literal of literals) {
    if (literal && literal.length >= 4) result = result.split(literal).join(DIAGNOSTIC_WITHHELD);
  }
  result = result
    .replace(URL_PATTERN, (_match, scheme: string, authority: string) => `${scheme}://${hostOnly(authority)}`)
    .replace(BEARER_PATTERN, (_match, kind: string) => `${kind} ${DIAGNOSTIC_WITHHELD}`)
    .replace(SECRET_ASSIGNMENT_PATTERN, (_match, key: string, separator: string) => `${key}${separator}${DIAGNOSTIC_WITHHELD}`)
    .replace(QUOTED_PATTERN, `"${DIAGNOSTIC_WITHHELD}"`)
    .replace(EMAIL_PATTERN, DIAGNOSTIC_WITHHELD)
    .replace(LONG_NUMBER_PATTERN, DIAGNOSTIC_WITHHELD)
    .replace(/\s+/g, " ")
    .trim();
  return result.length > MAXIMUM_DIAGNOSTIC_TEXT_LENGTH ? `${result.slice(0, MAXIMUM_DIAGNOSTIC_TEXT_LENGTH - 1)}…` : result;
}

/** An address's origin for a report: scheme, host and port, and nothing a URL can carry after them. */
export function diagnosticOrigin(address: string): string {
  try {
    const url = new URL(address);
    return `${url.protocol}//${url.host}`;
  } catch {
    return DIAGNOSTIC_WITHHELD;
  }
}

// `user:password@host:port` keeps `host:port`.
function hostOnly(authority: string): string {
  const at = authority.lastIndexOf("@");
  return at >= 0 ? authority.slice(at + 1) : authority;
}
