// What a failed wait for text, or a failed text assertion, saw of the text it
// wanted (t369).
//
// Lane A round 7's second qualifying run waited for "Cart (3)", which the
// crossborder-marketplace page holds only inside its closed mini-cart flyout
// (`apps/scenario-lab/src/scenarios/crossborder-marketplace/markup/flyouts.ts`).
// The failure said only that the text did not appear, so the build could not
// tell a wait for something hidden from a wait for something that is not there.
//
// So a failed text wait or text assertion carries two facts beside its record:
//
// - `textPresence`: `hidden` when the document holds the text but does not show
//   it, `absent` when the document does not hold it at all. A text the page
//   shows somewhere is neither, and then neither field is sent.
// - `visibleNear`: at most three snippets of text the page does show, each at
//   most 80 characters, that most resemble the awaited text. The content script
//   never reads a snippet from a control the sensitivity rule marks
//   (`../sensitivity`), and the runtime adapter drops any snippet the secret
//   screen would change before it reaches Core.
//
// They ride the action result as two top-level fields, are copied onto the
// gateway payload (`client/gateway-mapping.ts`), and reach Core on the failed
// command's `metadata.failureDiagnostics` (`runtime/adapter.ts`). They are not
// on the failure record itself: Core's parser drops a record with an unknown
// key whole (`parseAutomationStudioFailureRecord`), which would lose the
// failure rather than explain it. Each hop copies them through
// `webAutomationTextSightingValue`, which keeps a well-formed pair and nothing
// else.

/** Whether the document holds the awaited text without showing it, or does not hold it at all. */
export type WebAutomationTextPresence = "hidden" | "absent";

/** A failed text wait's account of the text: where it stands, and the shown text most like it. */
export type WebAutomationTextSighting = {
  textPresence: WebAutomationTextPresence;
  visibleNear: string[];
};

/** At most this many snippets of shown text. */
export const WEB_AUTOMATION_VISIBLE_NEAR_MAX_ITEMS = 3;

/** At most this many characters in one snippet. */
export const WEB_AUTOMATION_VISIBLE_NEAR_MAX_LENGTH = 80;

/**
 * The pair as it may travel: a known presence and up to three nonblank string
 * snippets within the length bound, or nothing when the presence is not one of
 * the two. A snippet over the bound is a malformed entry and is dropped rather
 * than cut, so nothing a producer did not choose to send is sent.
 */
export function webAutomationTextSightingValue(textPresence: unknown, visibleNear: unknown): WebAutomationTextSighting | undefined {
  if (textPresence !== "hidden" && textPresence !== "absent") return undefined;
  const snippets = Array.isArray(visibleNear)
    ? visibleNear.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0 && entry.length <= WEB_AUTOMATION_VISIBLE_NEAR_MAX_LENGTH)
    : [];
  return { textPresence, visibleNear: snippets.slice(0, WEB_AUTOMATION_VISIBLE_NEAR_MAX_ITEMS) };
}
