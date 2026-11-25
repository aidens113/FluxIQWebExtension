// The lines of a page after a delivery's `changes`, applied the way a model reads them (page-diff D1, P-b).
//
// A delivery's change lines come in groups in page order. A group opens with the
// unchanged line before it, shown after two spaces; then `- ` a line that left,
// `+ ` one that arrived and `~ ` one that now reads as shown. Only texts are
// shown, so a line is told apart by its text, and a `~ ` line by what it starts
// with: the handle, else its first word (a header's label).

/** The key a `~ ` line is matched by: the leading handle, else the leading word. */
function keyOf(text: string): string {
  return /^t\d+\b/u.exec(text)?.[0] ?? /^\S*/u.exec(text)?.[0] ?? "";
}

/** `before` with the change lines `changes` applied in order. A line a change names that is not there is left as the delivery says, never guessed at. */
export function applyPageChanges(before: readonly string[], changes: readonly string[]): string[] {
  const out: string[] = [];
  let at = 0;
  // Copy the unchanged lines up to the first one `found` accepts; the cursor ends after it, and whether one was found is returned.
  const advance = (found: (line: string) => boolean): boolean => {
    for (let index = at; index < before.length; index += 1) {
      if (!found(before[index]!)) continue;
      out.push(...before.slice(at, index));
      at = index + 1;
      return true;
    }
    return false;
  };
  for (const change of changes) {
    const mark = change.slice(0, 2);
    const text = change.slice(2);
    if (mark === "  ") {
      if (advance((line) => line === text)) out.push(text);
    } else if (mark === "- ") {
      advance((line) => line === text);
    } else if (mark === "+ ") {
      out.push(text);
    } else if (mark === "~ ") {
      const key = keyOf(text);
      advance((line) => keyOf(line) === key);
      out.push(text);
    }
  }
  out.push(...before.slice(at));
  return out;
}
