import type { AutomationStudioControlWordsReader } from "fluxiq/automation";

// Where a web node keeps its control's own words (Core's
// `runtime/llm/model-facing/control-words.ts`, reached through this domain's
// implementation bundle). The user's rule (2026-10-10): the model never sees how
// an element is found -- no locator, id, class, score, "address" or "fingerprint"
// -- but naming a control by its own words is fine: its accessible name, its
// visible text, its label, its placeholder.
//
// `element` is the identity this domain resolved from the step's handle at
// submission; `target` is the authored target, flat or as
// `{ kind: "element", fingerprint }`. Core collapses and screens what comes back.

/** The fields that carry a control's own words, in the order they are preferred. */
const WORD_FIELDS = ["accessibleName", "visibleText", "label", "placeholder"] as const;
/**
 * A flat authored target's `name` is its accessible name, and is read after the
 * fields above. On a resolved identity or a fingerprint `name` is the form
 * field's name attribute -- one of the signals a control is found by, like its
 * id or class -- and is never read (user, 2026-10-10).
 */
const AUTHORED_FIELDS = [...WORD_FIELDS, "name"] as const;

type Fields = Readonly<Record<string, unknown>>;

function record(value: unknown): Fields | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Fields : undefined;
}

function words(identity: Fields | undefined, fields: readonly string[]): string[] {
  return identity ? fields.map((field) => identity[field]).filter((value): value is string => typeof value === "string") : [];
}

export const webControlWordsReader: AutomationStudioControlWordsReader = (parameters) => {
  const element = record(parameters?.element);
  const target = record(parameters?.target);
  const fingerprint = record(target?.fingerprint);
  const flat = target && !fingerprint ? target : undefined;
  if (!element && !target) return undefined;
  return {
    words: [...words(element, WORD_FIELDS), ...words(fingerprint, WORD_FIELDS), ...words(flat, AUTHORED_FIELDS)],
    // A read step's element says its words are the value it reads, not a name for it.
    readsItsWords: element?.readsWords === true
  };
};
