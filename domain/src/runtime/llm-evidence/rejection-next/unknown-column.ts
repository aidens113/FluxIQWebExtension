// What a read refused for a column its list does not have is told (t1020).
//
// **The defect.** Live run `run-mwuuo3zk-75b482b3` detected a results list and
// was shown two handles in one packet: the list, whose card columns had long
// class-path keys, and the same list read one row per link (`cells`), whose
// three keys were short. Its first read named the list's handle with two of the
// cells' keys, and was refused `column_not_in_detected_list` with nothing but
// codes -- `web.handle.unknown_field:extractList.fields.1` and the shapes a
// handle is written in. The resolver had the name it could not find and every
// column the list has (`plan-resolution/extraction/unknown-column-issues.ts`),
// and the node run's refusal dropped them (`../node-run/run.ts`). The model
// switched to the cells' handle, where its keys were accepted, and read a table
// without the columns it needed for the rest of the run.
//
// **What is told.** The name the call wrote (its own input, bounded to a key's
// alphabet) rides in `instead` as `web.handle.unknown_column.<name>`, so a
// repeat of the refusal, which passes `instead` back (`../repeated-refusal.ts`),
// says the same. `next` names it, says a read keeps every column of its list
// and `fields` only picks columns by their names or keys, that the same read
// with no `fields` shows every column under its name (t1038, D13), and that a
// key listed under a detection's cells or record is a column of their handle and
// not of this list. The list's columns are not repeated: the refusal's issues
// carry them (`valid`), and a refusal carries no page-derived words
// (`../tool-rejection.ts`, header).

/** The prefix a refused column name rides under in `instead`. */
const UNKNOWN_COLUMN_CODE = "web.handle.unknown_column.";

/** A key a read can name: what the detection issues, and nothing longer. */
const KEY = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;

/** An element's own handle (`t12`), which a read takes as a list of that one element (`../plan-resolution/extraction/element-record.ts`). */
const ELEMENT_HANDLE = /^t[1-9][0-9]*$/u;

/**
 * A read through an element's own handle with columns a list would have (t1034). Bigbox run run-mwveg5ls-0266dfe0
 * (steps 240 and 242) read "the basket as a table" through the handle of one label the basket page had printed, with
 * columns item, quantity and price, and was told those were not columns "of the list this read's handle names" and to
 * use "keys from this list's own fields": there was no list and no detection, and it tried the same handle again. Such a
 * read reads one element as one row, whose columns are its own `text`, `value` and `link`; a table of several rows is a
 * list, detected where it stands and read through the handle that detection issues.
 */
function elementNext(target: string, said: string): string {
  return `Nothing was read: ${target} names one element, not a list, and ${said.startsWith("A column") ? "a column this read names is" : said} not one of its columns. `
    + "No list was found around it on this page, so the read reads that one element as one row, whose only columns are text, value and link. "
    + "A table of several rows is a list on the page that shows it: go to that page and read it there, naming the list by the handle of a line inside it, "
    + "with no fields to keep every column under its name.";
}

/** How many refused names are told at once. */
const MOST_NAMES = 4;

export const webLlmUnknownColumn = {
  /** The codes for the names no column answers to, one per name that is a key; none for anything else. */
  codes(issues: readonly { code: string; field?: string }[] | undefined): string[] {
    const names = (issues ?? []).flatMap((issue) => issue.code === "web.handle.unknown_field" && issue.field !== undefined && KEY.test(issue.field) ? [issue.field] : []);
    return [...new Set(names)].slice(0, MOST_NAMES).map((name) => `${UNKNOWN_COLUMN_CODE}${name}`);
  },
  /** What to do after a read named a column its list does not have, naming the names `instead` carries (header); where the read named an element's own handle, what that reads (below). */
  next(instead: readonly string[] | undefined, target?: string): string {
    const names = (instead ?? []).flatMap((code) => {
      const name = code.startsWith(UNKNOWN_COLUMN_CODE) ? code.slice(UNKNOWN_COLUMN_CODE.length) : undefined;
      return name !== undefined && KEY.test(name) ? [`\`${name}\``] : [];
    });
    const said = names.length === 0 ? "A column this read names is" : `${names.join(", ")} ${names.length === 1 ? "is" : "are"}`;
    if (target !== undefined && ELEMENT_HANDLE.test(target)) return elementNext(target, said);
    return `Nothing was read: ${said} not a column of the list this read names. `
      + "A read keeps every column of its list; fields only picks the ones asked, each written as {your name: name or key} with a column name or key of this list. "
      + "Run the same read with no fields to get every column under its name, then pick from those names. "
      + "A key of a detection's cells or record is a column of their own handle, not of this list.";
  }
};
