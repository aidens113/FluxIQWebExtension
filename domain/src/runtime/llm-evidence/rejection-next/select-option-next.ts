// What a select that named no option is told (t1081, bigbox `run-mwytbimp-e0c33977`
// steps 0014 and 0026: `label` beside the target, then `option: {label}` with no
// `by`, each retried four times with no reason).
//
// The refusal carries one closed code in `instead` (`../action-failure/refusal.ts`),
// so a repeat that passes it back says it again. The sentence names the shape and
// never a value the model sent.

/** The codes the select refusal carries in `instead`. */
export const WEB_SELECT_OPTION_CODE_PREFIX = "web.select.option.";

/** What to do about a select that names no option, or an option it cannot read; nothing where `instead` has no select code. */
export function selectOptionNext(instead: readonly string[] | undefined): string | undefined {
  const code = instead?.find((entry) => entry.startsWith(WEB_SELECT_OPTION_CODE_PREFIX));
  if (code === undefined) return undefined;
  const why = code.endsWith(".unreadable")
    ? "The option parameter was sent without a by that names value, label or index."
    : "The call named no option: label, text and similar keys beside the target are not read.";
  return `Nothing was chosen. ${why} `
    + "Name the option in one of two ways: value, the option's visible words as the page view prints them in [ | ] after the select's line, or its value; "
    + "or option, an object with by (value, label or index) and the key it names, for example {\"by\": \"label\", \"label\": \"the words\"} or {\"by\": \"index\", \"index\": 2}. "
    + "Send the same call again with one of these.";
}
