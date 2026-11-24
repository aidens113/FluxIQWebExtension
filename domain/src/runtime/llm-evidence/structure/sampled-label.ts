// Whether a stored label is one the model was shown in place of a generated
// class path: what the element is and its first item's value
// (`./field-sample.ts`, `link: '<a product title>'`, `lines: '<a> · <b>'`).
//
// Until t997 a detection stored that label in its record schema, and a saved
// read carries the schema it was saved with (`../plan-resolution/extraction/saved-list.ts`),
// so a Flow saved before then still holds a page value in a label. Its reader
// replaces such a label with the field's key, which is what the detection now
// stores for that column (`./stored-label.ts`).

/** The shape `./field-sample.ts` builds: one of its element words, a colon, the sample quoted, and a state mark's note. */
const SAMPLED = /^(?:link|button|heading|image|price|number|text|lines): '.*'(?:\s*\([^()]*\))?$/su;

/** Whether `label` is a readable label built from a sample rather than the page's own column words. */
export function webLlmSampledLabel(label: string): boolean {
  return SAMPLED.test(label);
}
