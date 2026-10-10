// What the extension's interference clearing pressed while an action ran, as an
// action result reports it (t401).
//
// Between an action's attempts the extension may press the way out of a layer
// the page put over itself -- a promotion's close glyph, a notification
// prompt's "Not now", a rate-limit notice's OK (`apps/extension/src/content/
// action-runtime/interference/`). That press is the one act the runtime takes
// that no Flow authored, so a reader must be able to see it as a fact: Core's
// trace and the chat say "Closed a notice the page put in the way" from it.
// Until this field it travelled only as a count inside the recovery sentence
// appended to the validation's `actual`.
//
// It carries two closed words per layer and nothing else: what kind of layer
// it was, and which dismissal the runtime pressed, named by the phrase the
// extension's allow-list matched, never by the control's own label. A label
// such as "No thanks, I would rather pay full price" is page text; "No thanks"
// is the vocabulary's. So the record can travel on any result without
// redaction.
//
// It is copied, never passed through, at each hop that carries it -- the
// gateway payload (`client/gateway-mapping.ts`) -- through
// `webAutomationClearedLayersValue`, which keeps known words only and at most
// `WEB_AUTOMATION_CLEARED_LAYERS_MAX` entries; an entry with an unknown word is
// dropped rather than guessed at.

import type { WebAutomationLayerKind } from "../page-evidence";

/**
 * What a cleared layer was: an interference kind the extension recognises, or
 * `dialog` for a layer no classifier named (a promotion, a newsletter modal).
 * A robot check is never cleared, so it never appears here.
 */
export type WebAutomationClearedLayerKind = Exclude<WebAutomationLayerKind, "robot_check"> | "dialog";

/** Every dismissal the clearing may press, by the allow-list phrase that admitted it. */
export const WEB_AUTOMATION_CLEARED_CONTROL_WORDS = [
  "Close",
  "Dismiss",
  "Minimise",
  "Hide",
  "Not now",
  "No thanks",
  "Maybe later",
  "Remind me later",
  "Later",
  "Skip",
  "Not interested",
  "Continue without",
  "Continue without accepting",
  "Reject",
  "Decline",
  "Refuse",
  "Deny",
  "Necessary only",
  "OK",
  "Got it",
  "Understood"
] as const;

export type WebAutomationClearedControlWord = (typeof WEB_AUTOMATION_CLEARED_CONTROL_WORDS)[number];

/** One layer the clearing closed: its kind and the dismissal pressed, both closed words. */
export type WebAutomationClearedLayer = {
  kind: WebAutomationClearedLayerKind;
  control: WebAutomationClearedControlWord;
};

/** At most this many cleared layers travel on one result: three per intervention, across a bounded loop. */
export const WEB_AUTOMATION_CLEARED_LAYERS_MAX = 12;

const KINDS: ReadonlySet<string> = new Set<WebAutomationClearedLayerKind>(["consent", "rate_limit", "promotion", "assistant", "dialog"]);
const WORDS: ReadonlySet<string> = new Set<string>(WEB_AUTOMATION_CLEARED_CONTROL_WORDS);

/**
 * The cleared layers as they may travel: each entry's two closed words and
 * nothing a producer put beside them, at most the bound, or nothing when no
 * entry is well formed.
 */
export function webAutomationClearedLayersValue(value: unknown): WebAutomationClearedLayer[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const layers: WebAutomationClearedLayer[] = [];
  for (const entry of value) {
    if (layers.length >= WEB_AUTOMATION_CLEARED_LAYERS_MAX) break;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const { kind, control } = entry as { kind?: unknown; control?: unknown };
    if (typeof kind !== "string" || !KINDS.has(kind)) continue;
    if (typeof control !== "string" || !WORDS.has(control)) continue;
    layers.push({ kind: kind as WebAutomationClearedLayerKind, control: control as WebAutomationClearedControlWord });
  }
  return layers.length > 0 ? layers : undefined;
}
