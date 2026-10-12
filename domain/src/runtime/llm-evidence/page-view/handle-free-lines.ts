// A page view's text read back as the lines two captures are compared by
// (t223; shared since t462).
//
// The lines are the view's element lines with what is positional taken out:
// the leading handle, and any handle the line names (`same href as t12`,
// `covered-by t3,t4`), since `t1` names the first element of whichever capture
// it came from. A link written on the page's own base (`~/cart`) is written out
// in full, since two pages may have different bases. Structure markers --
// `[main]`, `- 3/16`, `--- below the fold ---` -- are where things are, not what
// is there, and are left out. The title is the `PAGE "<title>"` header's.
//
// Read here, beside the writer of the view, by both comparisons: a state diff
// (`../../state-diff/summary-lines.ts`) and a build's start state
// (`../start-state/`). It was once copied into the second, because importing
// the first from inside this directory closed an import cycle.

const QUOTED = /"(?:[^"\\]|\\.)*"/gu;

/** The title and the handle-free element lines of a page view's text. */
export function webLlmHandleFreeViewLines(text: string): { title: string | undefined; lines: string[] } {
  const blank = text.indexOf("\n\n");
  const header = (blank < 0 ? text : text.slice(0, blank)).split("\n");
  const body = blank < 0 ? [] : text.slice(blank + 2).split("\n");
  const base = header.map((line) => /^URL .*\(~ = (\S+)\)$/u.exec(line)?.[1]).find((found) => found !== undefined);
  const lines = body.flatMap((line) => {
    const element = /^t[1-9][0-9]*(?: (.*))?$/u.exec(line);
    return element ? [handleFree(element[1] ?? "", base)] : [];
  });
  const quoted = header.map((line) => /^PAGE ("(?:[^"\\]|\\.)*")$/u.exec(line)?.[1]).find((found) => found !== undefined);
  return { title: quoted === undefined ? undefined : quoted.slice(1, -1).replace(/\\"/gu, "\""), lines };
}

/** The line with every handle outside quoted words written `t*`, and the page's `~` base written out. */
function handleFree(line: string, base: string | undefined): string {
  let out = "";
  let at = 0;
  for (const match of line.matchAll(QUOTED)) {
    out += unquoted(line.slice(at, match.index), base) + match[0];
    at = match.index + match[0].length;
  }
  return out + unquoted(line.slice(at), base);
}

function unquoted(part: string, base: string | undefined): string {
  const handles = part.replace(/\bt[1-9][0-9]*\b/gu, "t*");
  return base === undefined ? handles : handles.replace(/(^|\s)~(?=[/?#]|\s|$)/gu, `$1${base}`);
}
