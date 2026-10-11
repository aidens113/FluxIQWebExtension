// The names a repair check compares, and how it compares them: every name the
// recording knew a control by, every name the packet gives a proposed one, a
// name split into the words that are its identity, and whether a proposed name
// is the recorded one whole or shortened. `./equivalence.ts` and
// `./renamed-control.ts` both read names this way, so they live here rather
// than in either.

import type { WebAutomationElementFingerprint } from "../../../actions/types";
import { type WebLlmEvidenceElement } from "../elements";
import { isWithheldText } from "../withheld";

/** Words that join a second action to the first. */
export const NAME_CONJUNCTIONS: ReadonlySet<string> = new Set(["and", "then", "plus", "&", "+"]);

/** Every name the recording knew the control by. The authored `name` attribute is a form key, not a label. */
export function recordedNames(fingerprint: WebAutomationElementFingerprint): string[] {
  const attributes = fingerprint.attributes;
  return [fingerprint.accessibleName, fingerprint.visibleText, fingerprint.text, fingerprint.label, attributes?.["aria-label"], attributes?.title]
    .flatMap((value) => text(value) === undefined ? [] : [value as string]);
}

/**
 * The names the packet gives an element. The packet cuts no string (t200); a
 * name it withheld as shaped like a secret (`../withheld.ts`) is not the
 * element's name at all, so it is compared for nothing.
 *
 * The label is one of them (t425): a field a page names only by the words laid
 * beside it -- R4a's quantity box, "Quantity" in a sibling `<div>` and no
 * accessible name (`reports/r4a-debug-run-mv2pgqkj.md`) -- has its label as its
 * only name, and the recording names it by that label too, so without it a
 * repair to the very same box read as unanchored.
 */
export function evidenceNames(element: WebLlmEvidenceElement): string[] {
  return [element.name, element.label, element.text].flatMap((value) => text(value) === undefined || isWithheldText(value) ? [] : [value as string]);
}

/**
 * Whether a name survived the change: the same name, or the recorded name
 * shortened from the front, which is how a label is cut down ("Save changes"
 * to "Save"). A name that keeps only a later word ("Changes") is not the
 * recorded control answering to less of its name.
 */
export function namesAgree(named: readonly string[], recorded: readonly string[]): boolean {
  return named.some((candidate) => {
    const proposed = nameWords(candidate);
    return proposed.length > 0 && recorded.some((value) => {
      const known = nameWords(value);
      return known.length > 0 && proposed.every((word, index) => word === known[index]);
    });
  });
}

/** A name as it is compared: case, spacing and punctuation are not identity; a conjunction sign is a word. */
export function nameWords(value: string): string[] {
  return value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+|[&+]/gu) ?? [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
