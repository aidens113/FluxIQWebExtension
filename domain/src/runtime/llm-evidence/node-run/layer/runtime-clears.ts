// Whether the runtime's own popup defence clears the layers covering a control,
// so a press on it is sent rather than refused (lane 2 fix 4, `run-mvcxf4uz-64cd322c`).
//
// In exploration a press on a covered control was refused before it was sent
// (`../covered-target.ts`, C4 of `run-mup2i28c-6c7fc209`), and the model was to
// press the cover's closer and then press again. Live it did not: in two runs
// the builder pressed a control under a welcome modal about 25 times across
// five briefs, each refusal naming the modal's two closers, and never pressed
// either. Playback never asks the model. The extension's click refuses a
// covered target at its actionability gate, and its recovery presses the
// covering layer's way out by a closed allow-list, spares the layer that holds
// the target, never touches a challenge or a layer the run opened, and presses
// again (`apps/extension/src/content/actions/execute.ts`,
// `action-runtime/interference/`). So a covered press whose every cover that
// defence clears is sent, and the same defence clears it, as in playback; the
// press's result names each layer it closed (`clearedLayers`,
// `../../../../actions/cleared-layers.ts`), which the model reads on the press's
// `read`.
//
// Still refused, as before: a cover with no closer the defence would press --
// only a confirming Apply, Done or Save, or nothing -- a layer only a person can
// answer (a robot check, a sign-in, a one-time code, a payment confirmation),
// a layer a press of this build opened, which the defence never clears
// (`../own-layers/`, the extension's `run-opened.ts`), and more covers than it
// presses in one go.
//
// **The words are a copy of the extension's, not an import of them.** The
// domain must not depend on the extension (`scripts/structure-audit/config.mjs`),
// so the dismissal allow-list, the close glyph, the length bound, the
// consequential deny-list, the consent decline read only on a consent layer and
// the rate-limit acknowledgement read only on a rate-limit notice mirror
// `interference/vocabulary.ts` and `interference/consequential-word.ts`, and the
// person-only signals mirror `action-runtime/challenge-evidence.ts`. Closely,
// not exactly: the extension also reads what only the live page holds -- a
// disabled closer, a link away, a press guard on a control that acts -- and
// where this copy says yes and the page says no, the press comes back refused
// as covered, with the page, as any failed press does. Change both together.
//
// **A sign-in is read by its words, not its field.** The extension knows a
// sign-in by its password field, but the packet never carries one: a secret
// field is not described at all (`../../elements.ts`). So a layer whose own words
// ask to sign in, log in or give a password is a person's here, which also
// refuses a sign-in offer the extension would have closed. That is the safe
// direction: the refusal names its closers, as before.

import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";
import { webInLayer } from "./member";

/** The extension's `MAX_DISMISSALS_PER_ATTEMPT`: more covers than this are not all cleared in one press. */
const MOST_COVERS_CLEARED = 3;

/** `vocabulary.ts` `DISMISS_LABEL_MAX`: longer is prose that starts with a dismissal word, not a label. */
const DISMISS_LABEL_MAX = 48;

/** `vocabulary.ts` `DISMISS_LABEL`. */
const DISMISS_LABEL = /^(?:close|dismiss|minimi[sz]e|hide|not now|no,? thanks?|no thank you|maybe later|remind me later|later|skip|not interested|continue without)(?:$|[\s,.!:;-])/iu;

/** `vocabulary.ts` `CLOSE_GLYPH`. */
const CLOSE_GLYPH = /^[×✕✖╳xX]$/u;

/** `consequential-word.ts` `CONSEQUENTIAL_WORD`. */
const CONSEQUENTIAL_WORD = /\b(?:delete|deletes|deleting|remove|removes|removing|erase|erases|discard|discards|destroy|destroys|wipe|wipes|deactivate|deactivates|deactivating|unsubscribe|unsubscribes|cancel|cancels|cancelling|canceling|buy|buys|buying|purchase|purchases|purchasing|checkout|check-out|pay(?:ment|ments)|subscribe|subscribes|subscribing|upgrade|upgrades|downgrade|downgrades|withdraw|withdraws|transfer|transfers|donate|donates|publish|publishes|account|accounts|subscription|subscriptions|membership|memberships)\b/iu;

/** `vocabulary.ts` `CONSENT_DECLINE_LABEL`. */
const CONSENT_DECLINE_LABEL = /^(?:(?:reject|decline|refuse|deny)(?: all| optional| non-essential| additional)?|(?:use |allow )?(?:only )?(?:strictly )?(?:necessary|essential|required)(?: cookies)? only|only (?:allow |use )?(?:strictly )?(?:necessary|essential|required)|continue without accepting)(?:$|[\s,.!:;-])/iu;

/** `vocabulary.ts` `CONSENT_ACCEPT_WORD`. */
const CONSENT_ACCEPT_WORD = /\b(?:accept|accepts|agree|agrees|consent to)\b|\ballow all\b/iu;

/** `vocabulary.ts` `CONSENT_LAYER_WORD`. */
const CONSENT_LAYER_WORD = /\b(?:cookie|cookies|consent|privacy|tracking|trackers)\b/iu;

/** `vocabulary.ts` `RATE_LIMIT_LAYER_PHRASE`. */
const RATE_LIMIT_LAYER_PHRASE = /\b(?:(?:going|moving|posting|clicking|doing (?:this|that)) too (?:fast|quickly)|too many (?:requests|attempts|tries|actions)|slow down|temporarily (?:blocked|restricted|limited)|rate[- ]limit(?:ed)?|try again in \d+ ?(?:s|secs?|seconds?|mins?|minutes?)|wait \d+ ?(?:s|secs?|seconds?|mins?|minutes?) before)\b/iu;

/** `vocabulary.ts` `RATE_LIMIT_ACKNOWLEDGE_LABEL`. */
const RATE_LIMIT_ACKNOWLEDGE_LABEL = /^(?:ok|okay|got it|understood|i understand)[.!]?$/iu;

/** `challenge-evidence.ts` `PERSON_WORDS`, `CODE_WORDS` and `PAYMENT_WORDS`: a layer that says one is a person's. */
const PERSON_ONLY_WORDS = /\bcaptcha\b|\bnot an? (?:robot|bot)\b|\b(?:verify|confirm|prove) (?:that )?you(?:['’]re| are) (?:a )?human\b|\bare you (?:a )?(?:human|robot)\b|\bone[- ]time (?:pass)?code\b|\bverification code\b|\btwo[- ]factor\b|\b2-step verification\b|\bauthentication code\b|\bauthenticator app\b|\bconfirm (?:your |this )?(?:payment|purchase)\b|\bauthori[sz]e (?:this |the )?payment\b|\b3-?d ?secure\b|\bverify (?:your |this )?(?:payment|card)\b/iu;

/** A layer that asks for a sign-in, whose password field the packet withholds (header). */
const SIGN_IN_WORDS = /\b(?:sign[- ]?in|log[- ]?in|password)\b/iu;

/** The extension's explicit dismiss attributes (`way-out.ts` `saysDismissal`). */
const DISMISS_ATTRIBUTES: ReadonlySet<string> = new Set(["data-dismiss", "data-bs-dismiss"]);

/**
 * Whether every one of `covers` -- the layers over a control, by handle
 * (`../covered-target.ts`) -- is one the runtime's defence clears by its own
 * way out: none a person must answer, none a press of this build opened
 * (`own`), and each holding a closer the extension's allow-list presses. False
 * when there are none.
 */
export function webRuntimeClearsLayers(page: WebLlmPageEvidence, covers: readonly string[], own: (layer: string) => boolean = () => false): boolean {
  if (covers.length === 0 || covers.length > MOST_COVERS_CLEARED) return false;
  const byHandle = new Map(page.elements.map((element) => [element.target, element] as const));
  return covers.every((cover) => !own(cover) && clearable(page, byHandle, cover));
}

function clearable(page: WebLlmPageEvidence, byHandle: ReadonlyMap<string, WebLlmEvidenceElement>, cover: string): boolean {
  const layer = byHandle.get(cover);
  if (layer === undefined) return false;
  const members = page.elements.filter((element) => element.target !== cover && webInLayer(byHandle, element, cover));
  const kind = layer.kind ?? layer.isDialog?.kind;
  const text = [layer, ...members].map(words).join(" ");
  if (kind === "robot_check" || PERSON_ONLY_WORDS.test(text) || SIGN_IN_WORDS.test(text)) return false;
  if (members.some((element) => dismissAttribute(element) || dismissal(label(element)))) return true;
  if ((kind === "consent" || CONSENT_LAYER_WORD.test(text)) && members.some((element) => consentDecline(label(element)))) return true;
  return (kind === "rate_limit" || RATE_LIMIT_LAYER_PHRASE.test(text)) && members.some((element) => acknowledge(label(element)));
}

/** `vocabulary.ts` `isDismissalLabel`. */
function dismissal(text: string): boolean {
  if (text.length === 0 || text.length > DISMISS_LABEL_MAX) return false;
  if (CLOSE_GLYPH.test(text)) return true;
  return DISMISS_LABEL.test(text) && !CONSEQUENTIAL_WORD.test(text);
}

/** `vocabulary.ts` `isConsentDeclineLabel`. */
function consentDecline(text: string): boolean {
  if (text.length === 0 || text.length > DISMISS_LABEL_MAX || !CONSENT_DECLINE_LABEL.test(text)) return false;
  return !CONSENT_ACCEPT_WORD.test(text.replace(/^continue without accepting/iu, "")) && !CONSEQUENTIAL_WORD.test(text);
}

/** `vocabulary.ts` `isRateLimitAcknowledgeLabel`. */
function acknowledge(text: string): boolean {
  return text.length > 0 && text.length <= DISMISS_LABEL_MAX && RATE_LIMIT_ACKNOWLEDGE_LABEL.test(text) && !CONSEQUENTIAL_WORD.test(text);
}

function dismissAttribute(element: WebLlmEvidenceElement): boolean {
  return (element.attributes ?? []).some(([name]) => DISMISS_ATTRIBUTES.has(name));
}

/** The control's own label as the extension reads it: its accessible name, else its words, trimmed and collapsed. */
function label(element: WebLlmEvidenceElement): string {
  return (element.name ?? element.text ?? "").replace(/\s+/gu, " ").trim();
}

function words(element: WebLlmEvidenceElement): string {
  return [element.name, element.text, element.label].filter((part) => part !== undefined).join(" ");
}
