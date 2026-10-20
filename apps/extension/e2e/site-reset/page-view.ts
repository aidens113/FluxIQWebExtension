import type { JsonObject } from "fluxiq/core";

/** The rows of the page view: each `- N/M` or `- row N` block, after the page's own lines. */
function rowBlocks(page: string): string[] {
  return page.split(/\n- (?:\d+\/\d+|row \d+)\n/u).slice(1);
}

/** A handle line (`tN ...`) naming `label`, as the page view printed it. */
function handleLine(lines: readonly string[], label: string): string | undefined {
  return lines.find(line => /^t\d+ /u.test(line) && line.includes(JSON.stringify(label)))?.split(" ")[0];
}

/** The first control the page view shows with the words `label`; no selector or raw snapshot picks it. */
export function pageHandle(page: string, label: string): string {
  const found = handleLine(page.split("\n"), label);
  if (!found) throw new Error("diagnostic.control_missing");
  return found;
}

/** The handle of `label` in the page view's first line matching `pattern`, or none. */
export function pageHandleWhere(page: string, pattern: RegExp): string | undefined {
  return page.split("\n").find(line => /^t\d+ /u.test(line) && pattern.test(line))?.split(" ")[0];
}

/**
 * The control `label` whose next control line in the page view is `next`: one
 * control of a row of controls the page draws together, told from look-alikes
 * elsewhere by its neighbour's words.
 */
export function handleBefore(page: string, label: string, next: string): string {
  const controls = page.split("\n").filter(line => /^t\d+ /u.test(line));
  const at = controls.findIndex((line, index) => line.includes(JSON.stringify(label)) && controls[index + 1]?.includes(JSON.stringify(next)) === true);
  if (at < 0) throw new Error("diagnostic.control_missing");
  return controls[at]!.split(" ")[0]!;
}

/** A row's title, as the page view printed its link. */
function rowTitle(lines: readonly string[]): string | undefined {
  return lines.find(line => /^t\d+ (?:h[1-6] )?link "/u.test(line))?.match(/"(?:[^"\\]|\\.)*"/u)?.[0];
}

/**
 * The control `label` in a row of the page view, matched only by words
 * already observed in that row: the first row holding it, or the row titled
 * `identity`. `failed` is told what the view held when no row matched.
 */
export function rowControl(page: string, label: string, identity?: string, failed?: (facts: JsonObject) => void): { handle: string; identity: string } {
  const blocks = rowBlocks(page);
  for (const block of blocks) {
    const lines = block.split("\n");
    const title = rowTitle(lines);
    if (!title || (identity !== undefined && title !== identity)) continue;
    const control = handleLine(lines, label);
    if (control) return { handle: control, identity: title };
  }
  failed?.({ rowBlockCount: blocks.length, shownPageHasRequestedControl: page.includes(JSON.stringify(label)) });
  throw new Error("diagnostic.original_row_control_missing");
}

/** Every row title the page view printed, in order. */
export function rowTitles(page: string): string[] {
  return rowBlocks(page).map(block => rowTitle(block.split("\n"))).filter((title): title is string => title !== undefined);
}
