// Screens the reason Core's trace replay gives for a divergence down to a
// closed vocabulary (lane T P3). Core's reasons are its own sentences, but a
// few embed the text of a thrown error or a capture-loss detail, which could
// carry anything; those keep only their fixed part. A reason that matches no
// known template is withheld rather than passed on.

const KEPT: readonly RegExp[] = Object.freeze([
  /^Core did not derive it in the replay$/,
  /^the replay derived an event the recording does not have$/,
  /^the message it answers is missing from the trace$/,
  /^the trace lacks the command it belongs to \(sequence \d+ is missing\)$/,
  /^sequence \d+ is missing from the trace$/,
  /^the inbound event carries no message$/,
  /^the message could not be written down as JSON when it was captured$/,
  /^the replay could not pair a session to stand in for it$/,
  /^the artifact's bytes are not in the store$/,
  /^the refusal depended on host-lease or channel-scope state the trace does not hold$/,
  /^the trace does not say what the session's capabilities were, so the replay cannot know it answers reconcile questions$/,
  /^the replay cannot reproduce lifecycle event [a-z._]+$/,
  /^the replay cannot reproduce lifecycle event \(untyped\)$/,
  /^the event does not say which session connected$/,
  /^the hello's credential was withheld at capture, and Core's decision to resume the session depended on it$/,
  /^the event does not say which session it belongs to$/,
  /^no session stands in for session-\d+$/,
  /^the recorded message carries no command$/,
  /^the recorded host lease is malformed$/,
  /^the recorded command has no action type$/,
  /^recorded under another payload schema than the replay records$/,
  /^the disposition was recorded under schema version 1, which does not record what Core delivered for the message; every field it records matched$/,
  // A legacy trace (events naming no session) refused by Core's session-reference evaluation, with its fixed refusal.
  /^the event does not say which session it belongs to, and the trace cannot be shown to hold one session: (?:some of its events name their session and others do not|no outbound envelope or lifecycle record names a session id|its outbound envelopes and lifecycle records name more than one session id|its events name more than one client id|a session connects after the trace's first session-bound event|events are sent or received after the session disconnected)$/,
  /^delivered in another order than recorded: the replay feeds inputs one at a time$/,
  // D22: order is compared per causal chain; the chain is named by its kind, never an id.
  /^delivered in another order than recorded within its causal chain \((?:the inputs in the order received|an input and its disposition|one command's messages and outcomes|events correlated with no input or command)\)$/,
  /^the replay took \d+ artifacts where the recording took \d+, or different ones$/,
  // JSON pointers of withheld fields: field names and positions only (a secret-shaped key is already renamed at capture).
  /^(?:(?:\/[A-Za-z0-9_~ .\[\]-]*)*)(?:, (?:\/[A-Za-z0-9_~ .\[\]-]*)*)* was withheld at capture, and Core's handling of the message depended on it$/,
]);

/** Reasons whose tail is free text (an error message, a field list, a loss detail): only the fixed head is kept. */
type Head = readonly [RegExp, (match: RegExpMatchArray) => string];
const HEADS: readonly Head[] = Object.freeze<Head[]>([
  [/^(the replayed gateway refused to issue it): /, match => `${match[1]} (error text withheld)`],
  [/^(the replayed command failed): /, match => `${match[1]} (error text withheld)`],
  [/^(the replayed gateway failed to close): /, match => `${match[1]} (error text withheld)`],
  [/^(only ids or times Core minted differ): /, match => match[1] ?? ""],
  [/^(the same input, a different derivation): /, match => match[1] ?? ""],
  [/^sequence (\d+) was lost at capture \(([a-z][a-z0-9_-]*):/, match => `sequence ${match[1]} was lost at capture (${match[2]})`],
]);

export const WITHHELD_PARITY_REASON = "reason withheld: it matches no known template";

/** `detail` when it is one of Core's fixed reasons, its fixed head when its tail is free text, else a withheld marker. */
export function screenParityReason(detail: string): string {
  if (KEPT.some(pattern => pattern.test(detail))) return detail;
  for (const [pattern, keep] of HEADS) {
    const match = detail.match(pattern);
    if (match) return keep(match);
  }
  return WITHHELD_PARITY_REASON;
}
