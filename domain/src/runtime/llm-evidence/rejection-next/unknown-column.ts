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
// says the same. `next` names it, says a read takes only the keys listed under
// its own handle's fields, and that a key listed under a detection's cells or
// record is a column of their handle and not of this list. The list's columns
// are not repeated: they are the keys the detection's packet already showed,
// and a refusal carries no page-derived words (`../tool-rejection.ts`, header).

/** The prefix a refused column name rides under in `instead`. */
const UNKNOWN_COLUMN_CODE = "web.handle.unknown_column.";

/** A key a read can name: what the detection issues, and nothing longer. */
const KEY = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;

/** How many refused names are told at once. */
const MOST_NAMES = 4;

export const webLlmUnknownColumn = {
  /** The codes for the names no column answers to, one per name that is a key; none for anything else. */
  codes(issues: readonly { code: string; field?: string }[] | undefined): string[] {
    const names = (issues ?? []).flatMap((issue) => issue.code === "web.handle.unknown_field" && issue.field !== undefined && KEY.test(issue.field) ? [issue.field] : []);
    return [...new Set(names)].slice(0, MOST_NAMES).map((name) => `${UNKNOWN_COLUMN_CODE}${name}`);
  },
  /** What to do after a read named a column its list does not have, naming the names `instead` carries (header). */
  next(instead: readonly string[] | undefined): string {
    const names = (instead ?? []).flatMap((code) => {
      const name = code.startsWith(UNKNOWN_COLUMN_CODE) ? code.slice(UNKNOWN_COLUMN_CODE.length) : undefined;
      return name !== undefined && KEY.test(name) ? [`\`${name}\``] : [];
    });
    const said = names.length === 0 ? "A column this read names is" : `${names.join(", ")} ${names.length === 1 ? "is" : "are"}`;
    return `Nothing was read: ${said} not a column of the list this read's handle names. `
      + "A read takes only the keys listed under fields in the detection that issued its handle, each written as {your name: key}. "
      + "A key listed under that detection's cells or record is a column of their own handle, not of this list: read it through that handle, or leave it out. "
      + "Write the read again with keys from this list's own fields.";
  }
};
