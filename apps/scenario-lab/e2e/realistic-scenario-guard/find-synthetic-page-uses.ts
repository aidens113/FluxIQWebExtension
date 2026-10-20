/** One place a browser spec source opens, or serves, a page that is not a realistic scenario. */
export type SyntheticPageUse = { line: number; what: string };

const QUOTE = "[\"'`]";

/**
 * The places in one browser-spec source file that open a non-realistic
 * Scenario Lab scenario, or serve a page of the spec's own, given the ids of
 * the scenarios that are not realistic. Comments are ignored, so a comment may
 * still name a retired fixture. This is the static half of the rule; the
 * route guard (`installRealisticScenarioGuard`) is the runtime half.
 *
 * Found: a `/scenarios/<id>` path; `openHarness("<id>")`; `scenarioId: "<id>"`;
 * `readFinalState`, `armVariant`, `getScenario` or `getScenarioManifest` called
 * with the id; an import from a synthetic scenario's source; `setContent(`;
 * a `data:text/html` URL; and an HTTP server that answers `text/html`.
 */
export function findSyntheticPageUses(source: string, syntheticScenarioIds: readonly string[]): SyntheticPageUse[] {
  const code = stripComments(source);
  const uses: SyntheticPageUse[] = [];
  const lineOf = (index: number) => code.slice(0, index).split("\n").length;
  const scan = (pattern: RegExp, what: string) => {
    for (const match of code.matchAll(pattern)) uses.push({ line: lineOf(match.index ?? 0), what });
  };
  for (const id of syntheticScenarioIds) {
    const name = escapeRegExp(id);
    scan(new RegExp(`(?<!src)/scenarios/${name}(?=[/?#"'\`]|$)`, "gmu"), `opens synthetic scenario ${id}`);
    scan(new RegExp(`openHarness\\(\\s*${QUOTE}${name}${QUOTE}`, "gu"), `opens synthetic scenario ${id}`);
    scan(new RegExp(`scenarioId:\\s*${QUOTE}${name}${QUOTE}`, "gu"), `opens synthetic scenario ${id}`);
    scan(new RegExp(`(?:readFinalState|armVariant|getScenario|getScenarioManifest)\\([^)]*${QUOTE}${name}${QUOTE}`, "gu"), `uses synthetic scenario ${id}`);
    scan(new RegExp(`from\\s+${QUOTE}[^"'\`]*src/scenarios/${name}/`, "gu"), `imports synthetic scenario ${id}`);
  }
  scan(/\.setContent\(/gu, "serves its own page with setContent");
  scan(/data:text\/html/gu, "serves its own page as a data: URL");
  if (/\bcreateServer\b/u.test(code)) scan(/(?<!data:)text\/html/gu, "serves its own HTML page from an HTTP server");
  return uses.sort((a, b) => a.line - b.line);
}

/** Drops block comments and line comments, keeping line numbers; `//` inside a URL such as `http://` stays. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, " "))
    .replace(/(^|[^:"'`\w\\])\/\/[^\n]*/gmu, "$1");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
