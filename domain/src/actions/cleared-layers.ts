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
// It carries two closed words per layer: what kind of layer it was, and which
// dismissal the runtime pressed, named by the phrase the extension's allow-list
// matched. A label such as "No thanks, I would rather pay full price" is page
// text; "No thanks" is the vocabulary's.
//
// **And, since t516, the two names a page view already shows.** The deal-wheel
// gate run (`run-mv6v2hx5-f448e662`) met a promotion in playback, the defence
// closed it, and the Flow learned nothing: the user's rule is that an
// interruption met in a run becomes a branch of the Flow (wait for it, dismiss
// it, return), and a handler that waits for "a dialog" and presses "No thanks"
// can name neither the layer nor the control. So a layer also carries `name`,
// the layer's accessible name -- exactly what the snapshot's dialog evidence
// labels it and what a `dialog` fact's `nameContains` is matched against
// (`apps/extension/src/content/evidence/dialogs.ts`, `content/facts/judge.ts`)
// -- and `controlName`, the pressed control's accessible name. Both are page
// words every step log's page view already holds, collapsed to single spaces
// and cut at `WEB_AUTOMATION_CLEARED_NAME_MAX`; nothing else the page said
// travels, and neither is required.
//
// It is copied, never passed through, at each hop that carries it -- the
// gateway payload (`client/gateway-mapping.ts`) -- through
// `webAutomationClearedLayersValue`, which keeps known words only and at most
// `WEB_AUTOMATION_CLEARED_LAYERS_MAX` entries; an entry with an unknown word is
// dropped rather than guessed at.
//
// **The control pressed rides beside the words, as far as this domain (t470).**
// Lane D round 8 (`run-mv5jnc5m-a47c3e59`): the clearing closed the site's
// slow-down notice by its OK, Core's trial feedback could say only that a
// notice was closed, and the model, told to add a step closing it, pressed the
// one close-like handle it had seen -- the chat's "Close chat". So the client
// also reports the way out it pressed (`wayOut`): the page's address and the
// control's descriptor, exactly as a capture describes an element
// (`describeElement`, sensitivity screened at the source). It travels from the
// browser to this domain's server half and stops there: the dispatcher keeps it
// and hands Core only an opaque reference (`../io/gateway-output-dispatcher.ts`,
// `../cleared-way-outs/`), which Core gives back for a trial so this domain can
// name the control by a handle the model may write
// (`../runtime/llm-evidence/way-out-handles/`). A way out from a child frame is
// not reported: its descriptor carries no frame address.

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

/**
 * The way out the clearing pressed (t470): the address of the page it was on
 * and the control's descriptor, as a capture's `interactiveElements` carries
 * one. Never past this domain's server half (header).
 */
export type WebAutomationClearedWayOut = {
  url: string;
  element: Record<string, unknown>;
};

/**
 * One layer the clearing closed: its kind and the dismissal pressed, both
 * closed words; the layer's and the pressed control's accessible names when
 * the page gave them (t516); and the way out pressed when the client could
 * describe it.
 */
export type WebAutomationClearedLayer = {
  kind: WebAutomationClearedLayerKind;
  control: WebAutomationClearedControlWord;
  /** The layer's accessible name, as its page view labels the dialog. */
  name?: string | undefined;
  /** The pressed control's accessible name. */
  controlName?: string | undefined;
  wayOut?: WebAutomationClearedWayOut | undefined;
};

/** The most characters of a layer's or a control's name that travel: a heading or a button's line, never a paragraph. */
export const WEB_AUTOMATION_CLEARED_NAME_MAX = 120;

/** At most this many cleared layers travel on one result: three per intervention, across a bounded loop. */
export const WEB_AUTOMATION_CLEARED_LAYERS_MAX = 12;

/** The longest page address and descriptor a way out may carry; a larger one is dropped and the layer kept without it. */
const WAY_OUT_URL_MAX = 2_048;
const WAY_OUT_ELEMENT_MAX_BYTES = 16_384;

const KINDS: ReadonlySet<string> = new Set<WebAutomationClearedLayerKind>(["consent", "rate_limit", "promotion", "assistant", "dialog"]);
const WORDS: ReadonlySet<string> = new Set<string>(WEB_AUTOMATION_CLEARED_CONTROL_WORDS);

/**
 * The cleared layers as they may travel: each entry's two closed words, its
 * two bounded names, its way out, and nothing else a producer put beside
 * them; at most the bound, or nothing when no entry is well formed.
 */
export function webAutomationClearedLayersValue(value: unknown): WebAutomationClearedLayer[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const layers: WebAutomationClearedLayer[] = [];
  for (const entry of value) {
    if (layers.length >= WEB_AUTOMATION_CLEARED_LAYERS_MAX) break;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const { kind, control, name, controlName, wayOut } = entry as { kind?: unknown; control?: unknown; name?: unknown; controlName?: unknown; wayOut?: unknown };
    if (typeof kind !== "string" || !KINDS.has(kind)) continue;
    if (typeof control !== "string" || !WORDS.has(control)) continue;
    const layerName = nameValue(name);
    const pressedName = nameValue(controlName);
    const pressed = wayOutValue(wayOut);
    layers.push({
      kind: kind as WebAutomationClearedLayerKind,
      control: control as WebAutomationClearedControlWord,
      ...(layerName ? { name: layerName } : {}),
      ...(pressedName ? { controlName: pressedName } : {}),
      ...(pressed ? { wayOut: pressed } : {})
    });
  }
  return layers.length > 0 ? layers : undefined;
}

/** A name as it may travel: whitespace collapsed, cut at the bound, and nothing when no word is left. */
function nameValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const collapsed = value.replace(/\s+/gu, " ").trim().slice(0, WEB_AUTOMATION_CLEARED_NAME_MAX).trimEnd();
  return collapsed.length > 0 ? collapsed : undefined;
}

/** A way out as it may travel: a web page's address and one descriptor object, both bounded; anything else is none. */
function wayOutValue(value: unknown): WebAutomationClearedWayOut | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { url, element } = value as { url?: unknown; element?: unknown };
  if (typeof url !== "string" || url.length > WAY_OUT_URL_MAX || !/^https?:\/\//iu.test(url)) return undefined;
  if (typeof element !== "object" || element === null || Array.isArray(element)) return undefined;
  // A descriptor arrives as JSON (the wire, or the content script's structured message), so it always serializes.
  const bytes = new TextEncoder().encode(JSON.stringify(element)).length;
  return bytes <= WAY_OUT_ELEMENT_MAX_BYTES ? { url, element: element as Record<string, unknown> } : undefined;
}
