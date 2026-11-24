// Whether a detected column's label is a class path a build tool generated
// (`div.x0531l50.x1r2vv8 > div.x1a4yqcp`), which names nothing a person or a
// declaration would use. Two readers ask it: the label the model is shown
// (`./field-sample.ts`, which then describes the element and its sample) and the
// label a stored schema keeps (`./stored-label.ts`, which then keeps the key).

/** A class token a build tool generated: letters and digits run together (`x1a4yqcp`, `css-1q2w3e`, `sc-bdVaJa`, `_3xY7z`). */
const GENERATED_TOKEN = /^(?:css-|sc-|jsx-)|^(?=[\w-]*\d)(?=[\w-]*[a-z])[\w-]{5,}$/iu;
/** A label that is a class path: tags and classes joined by dots and child combinators. */
const CLASS_PATH = /^[\w-]+(?:[.:][\w()-]+)+(?:\s*>\s*[\w-]+(?:[.:][\w()-]+)*)*$/u;
/** A label's closing parenthetical, which the page side adds to say what a path column holds: `(currency amount)`, `(all lines)`. */
const LABEL_NOTE = /\s*\([^()]*\)$/u;

/** Whether `label`, its closing note aside, is a class path most of whose class names a build tool generated. */
export function webLlmGeneratedLabel(label: string): boolean {
  const path = label.replace(LABEL_NOTE, "").trim();
  if (!CLASS_PATH.test(path)) return false;
  const tokens = [...path.matchAll(/\.([\w-]+)/gu)].map((match) => match[1] ?? "");
  return tokens.length > 0 && tokens.filter((token) => GENERATED_TOKEN.test(token)).length * 2 >= tokens.length;
}
